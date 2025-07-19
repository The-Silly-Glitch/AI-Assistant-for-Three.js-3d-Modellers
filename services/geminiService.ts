
import { GoogleGenAI, Type } from "@google/genai";
import type { SceneGraph, SceneObject } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const TEXTURE_PLACEHOLDER = 'has_texture_placeholder';

/**
 * Prepares the scene for an API call by replacing large texture data with a placeholder.
 * @param scene The original scene graph.
 * @returns A tuple containing the sanitized scene and a map of original textures.
 */
const sanitizeSceneForApi = (scene: SceneGraph): [SceneGraph, Map<string, string>] => {
    const textureMap = new Map<string, string>();
    const sanitizedScene = scene.map(obj => {
        if (obj.material && obj.material.map) {
            textureMap.set(obj.id, obj.material.map);
            return {
                ...obj,
                material: {
                    ...obj.material,
                    map: TEXTURE_PLACEHOLDER
                }
            };
        }
        return obj;
    });
    return [sanitizedScene, textureMap];
};

/**
 * Restores original textures to a scene graph returned from the API.
 * @param scene The scene graph from the API, possibly with placeholders.
 * @param textureMap A map of object IDs to their original texture data URLs.
 * @returns A scene graph with placeholders replaced by actual texture data.
 */
const restoreTexturesAfterApi = (scene: SceneGraph, textureMap: Map<string, string>): SceneGraph => {
    return scene.map(obj => {
        if (obj.material && obj.material.map && obj.material.map === TEXTURE_PLACEHOLDER) {
            const originalMap = textureMap.get(obj.id);
            if (originalMap) {
                // Restore the original texture
                return {
                    ...obj,
                    material: {
                        ...obj.material,
                        map: originalMap,
                    }
                };
            } else {
                // If for some reason the original texture is not found, remove the placeholder.
                const { map, ...restMaterial } = obj.material;
                return { ...obj, material: restMaterial };
            }
        }
        return obj;
    });
};


const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'Unique identifier for the object, e.g., "cube-1".' },
      type: { type: Type.STRING, description: 'Must be "mesh".' },
      geometry: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: 'The shape of the object. Supported values: "box", "sphere", "plane", "cylinder", "cone", "torus".' },
          args: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Arguments for the geometry constructor. Box: [width, height, depth]. Sphere: [radius, widthSegments, heightSegments]. Plane: [width, height]. Cylinder: [radiusTop, radiusBottom, height, radialSegments]. Cone: [radius, height, radialSegments]. Torus: [radius, tube, radialSegments, tubularSegments].' },
        },
        required: ['type', 'args'],
      },
      material: {
        type: Type.OBJECT,
        properties: {
          color: { type: Type.STRING, description: 'Hex color code, e.g., "#ff0000" for red.' },
          metalness: { type: Type.NUMBER, description: 'How metallic the material is, from 0.0 to 1.0.' },
          roughness: { type: Type.NUMBER, description: 'How rough the material is, from 0.0 to 1.0.' },
          map: { type: Type.STRING, description: `Optional. If an object already has a texture, this property will be set to "has_texture_placeholder". To keep the existing texture on the object, include this property with the value "has_texture_placeholder". To remove the texture, omit this property.` },
        },
        required: ['color'],
      },
      position: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: '3D position as [x, y, z].',
      },
      rotation: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: '3D rotation in Euler angles [x, y, z] in radians.',
      },
      scale: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: '3D scale as [x, y, z].',
      },
    },
    required: ['id', 'type', 'geometry', 'material', 'position'],
  }
};

const callGemini = async (contents: string, systemInstruction: string): Promise<SceneGraph> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const scene = JSON.parse(jsonText);
        return scene as SceneGraph;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate or parse scene from Gemini: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the scene.");
    }
}

export const generateSceneGraph = async (prompt: string): Promise<SceneGraph> => {
  const systemInstruction = `You are an expert 3D scene generator. Create a JSON array of objects representing a 3D scene based on the user's prompt. Adhere strictly to the provided JSON schema. Ensure all object IDs are unique. Position objects logically, for example, not overlapping and resting on a ground plane (y=0) realistically. If a plane is requested, make it large enough to serve as a floor. A standard rotation for a floor plane is [-Math.PI / 2, 0, 0]. For user prompts, interpret sizes relatively. e.g. a 'large' sphere should have a larger radius than a 'small' one.`;
  const contents = `The user's request is: "${prompt}"`;
  return callGemini(contents, systemInstruction);
};

export const modifySceneGraph = async (prompt: string, currentScene: SceneGraph): Promise<SceneGraph> => {
  const systemInstruction = `You are an expert 3D scene editor. You will receive a user's prompt for a modification and the current 3D scene as a JSON array.
Your task is to modify the scene according to the user's prompt. This can involve adding new objects, removing existing ones, or changing properties of existing objects (like color, position, or scale).
- When modifying an existing object, you MUST preserve its original 'id'.
- When adding a new object, you MUST assign a new, unique 'id' that is not present in the current scene.
- Return the complete, updated JSON array for the entire scene. Do not return only the changed objects.
- Ensure the final JSON is valid and adheres to the schema.`;
  
  const [sanitizedScene, textureMap] = sanitizeSceneForApi(currentScene);
  const contents = `User's modification request: "${prompt}".\n\nCurrent scene graph: ${JSON.stringify(sanitizedScene)}.`;
  
  const newSceneFromGemini = await callGemini(contents, systemInstruction);
  return restoreTexturesAfterApi(newSceneFromGemini, textureMap);
};

export const regenerateObject = async (prompt: string, scene: SceneGraph, objectId: string): Promise<SceneGraph> => {
    const systemInstruction = `You are an expert 3D scene editor. You will be given a user's prompt, a full 3D scene as a JSON array, and the ID of a specific object to regenerate. Your task is to regenerate ONLY the object with the specified ID based on the user's prompt, keeping the ID the same. You can change its geometry, material, position, rotation, or scale. Do NOT modify any other objects in the scene. Return the complete, updated JSON array for the entire scene.`;
    
    const [sanitizedScene, textureMap] = sanitizeSceneForApi(scene);
    const contents = `User's prompt: "${prompt}".\n\nCurrent scene graph: ${JSON.stringify(sanitizedScene)}.\n\nRegenerate the object with ID: "${objectId}".`;
    
    const newSceneFromGemini = await callGemini(contents, systemInstruction);
    return restoreTexturesAfterApi(newSceneFromGemini, textureMap);
}

export const generateImageTexture = async (prompt: string): Promise<{ imageBytes: string, mimeType: string }> => {
    
    
    try {
        const response = await fetch(
            "https://router.huggingface.co/nebius/v1/images/generations",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HUGGING_FACE_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: prompt,
                    model: "black-forest-labs/flux-dev",
                    response_format: "b64_json",
                    n: 1,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // Assuming OpenAI-compatible response structure for b64_json
        if (result.data && result.data.length > 0 && result.data[0].b64_json) {
            return {
                imageBytes: result.data[0].b64_json,
                mimeType: 'image/png', // Hugging Face API with b64_json usually returns PNG.
            };
        }
        
        throw new Error('No image was generated. The response from Hugging Face was empty or in an unexpected format.');

    } catch (error) {
        console.error("Error calling Hugging Face Image API:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate image texture: ${error.message}`);
        }
        throw new Error("An unknown error occurred while generating the image.");
    }
};
