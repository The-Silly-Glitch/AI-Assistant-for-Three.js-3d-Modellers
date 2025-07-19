import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import Viewer from './components/Viewer';
import Loader from './components/Loader';
import { generateSceneGraph, regenerateObject, generateImageTexture, modifySceneGraph } from './services/geminiService';
import type { SceneGraph, SceneObject } from './types';
import { GeometryType } from './types';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';


const WandIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 4V2" /><path d="M15 10v-2" /><path d="M15 16v-2" /><path d="M15 22v-2" /><path d="M20.66 6.34l-1.42-1.42" /><path d="M3.34 17.66l1.42 1.42" /><path d="M17.66 3.34l1.42 1.42" /><path d="M6.34 20.66l-1.42-1.42" /><path d="M18 12h2" /><path d="M12 12h-2" /><path d="M4 12H2" /><path d="M12 6V4" /><path d="M12 18v-2" /><path d="M12 22v-2" /><path d="m12 12 4 10 3-3-10-4z" />
  </svg>
);

const CodeIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>
    </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const UploadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

const RefreshCwIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>
    </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const initialScene: SceneGraph = [
  { id: 'floor-plane-initial', type: 'mesh', geometry: { type: GeometryType.Plane, args: [20, 20] }, material: { color: '#2d3436', roughness: 0.9, metalness: 0.1 }, position: [0, -1.5, 0], rotation: [-Math.PI / 2, 0, 0], },
  { id: 'main-sphere-initial', type: 'mesh', geometry: { type: GeometryType.Sphere, args: [1, 32, 32] }, material: { color: '#0984e3', metalness: 0.2, roughness: 0.1 }, position: [0, -0.5, 0], },
  { id: 'main-box-initial', type: 'mesh', geometry: { type: GeometryType.Box, args: [1, 1, 1] }, material: { color: '#d63031', metalness: 0.1, roughness: 0.6 }, position: [-2.5, -1, 0], },
  { id: 'main-torus-initial', type: 'mesh', geometry: { type: GeometryType.Torus, args: [0.6, 0.2, 16, 100] }, material: { color: '#fdcb6e', metalness: 0.8, roughness: 0.2 }, position: [2.5, -0.7, 0], },
];

const App = () => {
  const [prompt, setPrompt] = useState<string>('A red sports car on a gray plane');
  const [texturePrompt, setTexturePrompt] = useState<string>('A carbon fiber pattern');
  const [sceneGraph, setSceneGraph] = useState<SceneGraph>(initialScene);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTextureLoading, setIsTextureLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [editableCode, setEditableCode] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [textureHistory, setTextureHistory] = useState<string[]>([]);
  
  const viewerRef = useRef<{ exportGLB: () => void }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageTextureInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedObjectIds.length > 0) {
        event.preventDefault(); // Prevent browser back navigation on Backspace
        setSceneGraph(prevGraph => prevGraph.filter(obj => !selectedObjectIds.includes(obj.id)));
        setSelectedObjectIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedObjectIds]);

  const handleSelectObject = useCallback((objectId: string | null, shiftKey: boolean) => {
    if (objectId === null) {
        setSelectedObjectIds([]);
        return;
    }

    if (shiftKey) {
        setSelectedObjectIds(prevIds => 
            prevIds.includes(objectId)
                ? prevIds.filter(id => id !== objectId)
                : [...prevIds, objectId]
        );
    } else {
        setSelectedObjectIds(prevIds => 
            prevIds.length === 1 && prevIds[0] === objectId 
            ? [] 
            : [objectId]
        );
    }
  }, []);

  const handleGenerateScene = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the scene.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsDropdownOpen(false);
    try {
      const newScene = await generateSceneGraph(prompt);
      setSceneGraph(newScene);
      setSelectedObjectIds([]); // Deselect object on new scene
      setTextureHistory([]); // Clear texture history
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt]);

  const handleModifyScene = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Please enter a description for the modification.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsDropdownOpen(false);
    try {
      const newScene = await modifySceneGraph(prompt, sceneGraph);
      setSceneGraph(newScene);
      setSelectedObjectIds([]); // Deselect object on scene change
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, sceneGraph]);

  const handleRegenerateObject = useCallback(async () => {
    if (selectedObjectIds.length === 0) {
      setError('Please select an object to regenerate.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsDropdownOpen(false);
    try {
      let currentScene = sceneGraph;
      for (const objectId of selectedObjectIds) {
        currentScene = await regenerateObject(prompt, currentScene, objectId);
      }
      setSceneGraph(currentScene);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [prompt, sceneGraph, selectedObjectIds]);

  const handleApplyTexture = useCallback(async () => {
      if (selectedObjectIds.length === 0) {
          setError('Please select an object to apply the texture to.');
          return;
      }
      if (!texturePrompt.trim()) {
          setError('Please enter a description for the texture.');
          return;
      }
      setIsTextureLoading(true);
      setError(null);
      try {
          const { imageBytes, mimeType } = await generateImageTexture(texturePrompt);
          const imageUrl = `data:${mimeType};base64,${imageBytes}`;
          
          setTextureHistory(prev => [imageUrl, ...prev.slice(0, 8)]); // Keep latest 9

          const newSceneGraph = sceneGraph.map(obj => {
              if (selectedObjectIds.includes(obj.id)) {
                  return {
                      ...obj,
                      material: {
                          ...obj.material,
                          map: imageUrl,
                      },
                  };
              }
              return obj;
          });
          setSceneGraph(newSceneGraph);
      } catch (e: unknown) {
          if (e instanceof Error) {
              setError(e.message);
          } else {
              setError('An unexpected error occurred while generating texture.');
          }
      } finally {
          setIsTextureLoading(false);
      }
  }, [texturePrompt, selectedObjectIds, sceneGraph]);

  const handleApplyTextureFromHistory = useCallback((imageUrl: string) => {
    if (selectedObjectIds.length === 0) {
        setError('Please select an object before applying a texture from history.');
        return;
    }
    setError(null);
    const newSceneGraph = sceneGraph.map(obj => {
        if (selectedObjectIds.includes(obj.id)) {
            return {
                ...obj,
                material: {
                    ...obj.material,
                    map: imageUrl,
                },
            };
        }
        return obj;
    });
    setSceneGraph(newSceneGraph);
  }, [selectedObjectIds, sceneGraph]);

  const handleImageTextureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || selectedObjectIds.length === 0) {
        if (event.target) event.target.value = '';
        return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        if (!imageUrl) {
            setError('Failed to read the image file.');
            return;
        }
        setTextureHistory(prev => [imageUrl, ...prev.slice(0, 8)]);
        const newSceneGraph = sceneGraph.map(obj => {
            if (selectedObjectIds.includes(obj.id)) {
                return {
                    ...obj,
                    material: {
                        ...obj.material,
                        map: imageUrl,
                    },
                };
            }
            return obj;
        });
        setSceneGraph(newSceneGraph);
    };
    reader.onerror = () => {
        setError('Failed to read the file.');
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target?.result;
        if (content instanceof ArrayBuffer) {
            const loader = new GLTFLoader();
            loader.parse(
                content,
                '',
                (gltf) => {
                    const newObjects: SceneGraph = [];
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            const mesh = child;
                            mesh.updateWorldMatrix(true, false);
                            mesh.geometry.computeBoundingBox();

                            const bbox = mesh.geometry.boundingBox!.clone();
                            bbox.applyMatrix4(mesh.matrixWorld);

                            const center = new THREE.Vector3();
                            bbox.getCenter(center);

                            const size = new THREE.Vector3();
                            bbox.getSize(size);

                            if (size.x === 0 || size.y === 0 || size.z === 0) return;

                            const color = (mesh.material instanceof THREE.MeshStandardMaterial) ? `#${mesh.material.color.getHexString()}` : '#cccccc';
                            const metalness = (mesh.material instanceof THREE.MeshStandardMaterial) ? mesh.material.metalness : 0.5;
                            const roughness = (mesh.material instanceof THREE.MeshStandardMaterial) ? mesh.material.roughness : 0.5;

                            const newObject: SceneObject = {
                                id: `imported-${mesh.uuid}`,
                                type: 'mesh',
                                geometry: {
                                    type: GeometryType.Box,
                                    args: [size.x, size.y, size.z],
                                },
                                material: { color, metalness, roughness },
                                position: [center.x, center.y, center.z],
                                rotation: [0, 0, 0],
                                scale: [1, 1, 1],
                            };
                            newObjects.push(newObject);
                        }
                    });

                    if (newObjects.length === 0) {
                        setError("No valid meshes found in the GLB file.");
                    } else {
                        setSceneGraph(prev => [...prev, ...newObjects]);
                        setSelectedObjectIds([]);
                    }
                    if (event.target) event.target.value = '';
                    setIsLoading(false);
                },
                (error) => {
                    console.error('Error parsing GLB:', error);
                    setError('Failed to parse the GLB file.');
                    setIsLoading(false);
                }
            );
        }
    };
    reader.onerror = () => {
        setError('Failed to read the file.');
        setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleOpenCodeModal = () => {
    setEditableCode(JSON.stringify(sceneGraph, null, 2));
    setCodeError(null);
    setIsCodeModalOpen(true);
  };

  const handleApplyCode = () => {
    try {
        const newScene = JSON.parse(editableCode);
        if (!Array.isArray(newScene)) {
            throw new Error('Scene code must be a valid JSON array.');
        }
        // Basic validation
        newScene.forEach((obj: any) => {
            if (!obj.id || !obj.type || !obj.geometry || !obj.material || !obj.position) {
                throw new Error(`Object ${JSON.stringify(obj)} is missing required properties.`);
            }
        });
        setSceneGraph(newScene as SceneGraph);
        setIsCodeModalOpen(false);
        setSelectedObjectIds([]);
    } catch (e: unknown) {
        if (e instanceof Error) {
            setCodeError(e.message);
        } else {
            setCodeError('An unexpected error occurred while parsing the JSON.');
        }
    }
  };

  const handleDownload = () => {
    viewerRef.current?.exportGLB();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editableCode);
    setCopyButtonText('Copied!');
    setTimeout(() => setCopyButtonText('Copy'), 2000);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white font-sans">
      <aside className="w-[380px] flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-r border-gray-700/50 flex flex-col p-6 shadow-2xl z-20">
        <div className="flex-grow flex flex-col overflow-y-auto pr-2">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            3D Visualizer
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Describe a 3D scene and watch it come to life.
            </p>
          </header>

          <div className="flex flex-col space-y-4">
            <label htmlFor="prompt-input" className="font-medium text-gray-300">
              Scene Description
            </label>
            <textarea
              id="prompt-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A blue sphere next to a tall red cylinder on a metal floor"
              className="w-full h-32 p-3 bg-gray-800 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200"
              disabled={isLoading || isTextureLoading}
            />
          </div>

          <div className="relative mt-6" ref={dropdownRef}>
            <div className="flex rounded-lg shadow-lg">
                <button
                    onClick={handleGenerateScene}
                    disabled={isLoading || isTextureLoading}
                    className="w-full flex items-center justify-center px-4 py-3 font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-l-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
                >
                    {isLoading ? <Loader /> : <><WandIcon className="w-5 h-5 mr-2" /> Generate Scene</>}
                </button>
                <button
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    disabled={isLoading || isTextureLoading}
                    aria-haspopup="true"
                    aria-expanded={isDropdownOpen}
                    className="flex-shrink-0 px-2 bg-indigo-600 hover:bg-indigo-700 rounded-r-lg text-white disabled:opacity-50"
                >
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-full bg-gray-700 rounded-md shadow-xl py-1 z-30">
                    <button
                        onClick={handleModifyScene}
                        disabled={isLoading || isTextureLoading}
                        className="w-full flex items-center px-4 py-2 text-sm text-left text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PlusIcon className="w-4 h-4 mr-3" />
                        Modify Scene
                    </button>
                    <button
                        onClick={handleRegenerateObject}
                        disabled={selectedObjectIds.length === 0 || isLoading || isTextureLoading}
                        className="w-full flex items-center px-4 py-2 text-sm text-left text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCwIcon className="w-4 h-4 mr-3" />
                        Regenerate Selected
                    </button>
                </div>
            )}
          </div>

          <hr className="my-6 border-gray-700" />

          <div className={`flex flex-col space-y-4 transition-opacity duration-300 ${selectedObjectIds.length > 0 ? 'opacity-100' : 'opacity-40'}`}>
            <label htmlFor="texture-prompt-input" className="font-medium text-gray-300">
              Texture Prompt (for selected object)
            </label>
            <textarea
              id="texture-prompt-input"
              value={texturePrompt}
              onChange={(e) => setTexturePrompt(e.target.value)}
              placeholder="e.g., a photorealistic oak wood grain"
              className="w-full h-24 p-3 bg-gray-800 border border-gray-700 rounded-md resize-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors duration-200"
              disabled={selectedObjectIds.length === 0 || isLoading || isTextureLoading}
            />
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={handleApplyTexture}
                    disabled={selectedObjectIds.length === 0 || isTextureLoading || isLoading}
                    className="w-full flex items-center justify-center px-4 py-3 font-bold text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500"
                >
                    {isTextureLoading ? <Loader /> : <><WandIcon className="w-5 h-5 mr-2" /> Generate</>}
                </button>
                <input
                    type="file"
                    ref={imageTextureInputRef}
                    onChange={handleImageTextureUpload}
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    disabled={selectedObjectIds.length === 0 || isLoading || isTextureLoading}
                />
                <button
                    onClick={() => imageTextureInputRef.current?.click()}
                    disabled={selectedObjectIds.length === 0 || isLoading || isTextureLoading}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                    <UploadIcon className="w-5 h-5 mr-2" /> Upload
                </button>
            </div>
             {selectedObjectIds.length > 0 && (
                <p className="text-xs text-gray-500 text-center -mt-2">
                    Or press 'Delete' to remove selected object(s).
                </p>
            )}
            {textureHistory.length > 0 && (
              <div className="mt-4">
                <label className="font-medium text-gray-300">Texture History</label>
                <div className="mt-2 grid grid-cols-3 gap-2 p-2 bg-gray-800 border border-gray-700 rounded-md">
                    {textureHistory.map((textureUrl, index) => (
                        <button
                            key={index}
                            onClick={() => handleApplyTextureFromHistory(textureUrl)}
                            className="group relative aspect-square bg-gray-700 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 transition-transform transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                            disabled={selectedObjectIds.length === 0}
                            aria-label={`Apply texture ${index + 1}`}
                        >
                            <img src={textureUrl} alt={`Generated Texture ${index + 1}`} className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-75" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                <CheckIcon className="w-8 h-8 text-white" />
                            </div>
                            <a
                                href={textureUrl}
                                download={`texture-${index + 1}.png`}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute bottom-1 right-1 p-1.5 bg-gray-900/50 rounded-full text-gray-300 hover:text-white hover:bg-gray-900/80 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Download Texture"
                                aria-label="Download this texture"
                            >
                                <DownloadIcon className="w-4 h-4" />
                            </a>
                        </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-auto pt-6">
              <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleOpenCodeModal} disabled={isLoading || isTextureLoading} className="flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200 disabled:opacity-50">
                      <CodeIcon className="w-5 h-5 mr-2" /> View/Edit Code
                  </button>
                  <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".glb"
                      className="hidden"
                      disabled={isLoading || isTextureLoading}
                  />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isLoading || isTextureLoading} className="flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200 disabled:opacity-50">
                      <UploadIcon className="w-5 h-5 mr-2" /> Upload .glb
                  </button>
                  <button onClick={handleDownload} disabled={isLoading || isTextureLoading} className="col-span-2 flex items-center justify-center p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200 disabled:opacity-50">
                      <DownloadIcon className="w-5 h-5 mr-2" /> Download .glb
                  </button>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/50 text-red-300 border border-red-700/50 rounded-md text-sm">
                  <p className="font-bold">Error</p>
                  <p>{error}</p>
                </div>
              )}
          </div>
        </div>
        
        
      </aside>

      <main className="flex-grow relative z-10">
        <Viewer
          ref={viewerRef}
          sceneGraph={sceneGraph}
          selectedObjectIds={selectedObjectIds}
          setSelectedObjectId={handleSelectObject}
        />
      </main>

      {isCodeModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-700">
            <header className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Scene Code</h2>
              <button onClick={() => setIsCodeModalOpen(false)} className="text-gray-400 hover:text-white">&times;</button>
            </header>
            <textarea
              value={editableCode}
              onChange={(e) => setEditableCode(e.target.value)}
              className="p-4 overflow-auto text-sm bg-gray-900/50 flex-grow font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              spellCheck="false"
            />
             {codeError && (
                <div className="p-2 bg-red-900/50 text-red-300 text-xs font-mono">
                    {codeError}
                </div>
            )}
            <footer className="p-4 border-t border-gray-700 flex justify-end gap-3">
              <button onClick={handleApplyCode} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md transition-colors text-sm font-semibold">Apply Changes</button>
              <button onClick={handleCopyCode} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors text-sm">{copyButtonText}</button>
              <button onClick={() => setIsCodeModalOpen(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors text-sm">Close</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;