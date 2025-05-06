'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { Font, FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';


const resize = (width: number, height: number, pixelRatio: number, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) => {
  if (!renderer || !camera) {
    console.warn("Renderer or camera is not initialized yet");
    return;
  }

  if (!width || !height) {
    throw new Error("Width and height must be provided");
  }

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(pixelRatio);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let font: any = null;

const pinkColor = new THREE.Color('rgb(255,120,120)'); // 背景色

export default function Home() {
  const [text, setText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') {
        setText(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        setText(prev => prev + '\n');
      } else if (e.key.length === 1) {
        setText(prev => prev + e.key);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(new THREE.Color('rgb(120,200,120)')); 
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const near = 0.1;
    const far = 100000;
    const camera = new THREE.PerspectiveCamera(75, width / height, near, far);
    camera.position.set(0, 0, 1000);
    cameraRef.current = camera;

    // OrbitControlsのセットアップ
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true; // ← これがズーム有効化
    controls.minDistance = 500; // ズームインの最小距離
    controls.maxDistance = 10000; // ズームアウトの最大距離

    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xfffff, 3.0);
    scene.add(ambientLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleDoubleClick = () => {
      const currentCamera = cameraRef.current;
      const currentControls = controlsRef.current;
      if (!currentCamera || !currentControls) return;

      gsap.to(currentCamera.position, {
        x: 0,
        y: 0,
        z: 1000,
        duration: 1,
        onUpdate() {
          currentControls.update();
        },
      });

      gsap.to(currentControls.target, {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
        onUpdate() {
          currentControls.update();
        },
      });
    };
    
    window.addEventListener('dblclick', handleDoubleClick);

    const handleResize = () => {
      if (!rendererRef.current || !cameraRef.current || !containerRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const pixelRatio = window.devicePixelRatio;

      resize(width, height, pixelRatio, rendererRef.current, cameraRef.current);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const fontLoader = new FontLoader();
    fontLoader.load('/fonts/Trattatello_Regular.json', (loadedFont: Font) => {
      font = loadedFont;
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('dblclick', handleDoubleClick);
      controls.dispose();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentElement) {
          rendererRef.current.domElement.parentElement.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sceneRef.current || !font || !text.trim()) return;

      const scene = sceneRef.current;

      // 前回のテキストグループが存在すれば削除
      if (scene.userData.textGroup) {
        scene.remove(scene.userData.textGroup);
        scene.userData.textGroup.children.forEach((child: THREE.Mesh) => {
          child.geometry.dispose();
          const mat = child.material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        });
      }
      

      const group = new THREE.Group();
      const lines = text.split('\n');
      const lineHeight = 30;

      lines.forEach((line, index) => {
        const geometry = new TextGeometry(line, { font, size: 20, depth: 100 });
        const materials = [
          new THREE.MeshBasicMaterial({ color: pinkColor }), // 正面（表裏）
          new THREE.MeshBasicMaterial({ color: 'red' })    // 側面
        ];
        const mesh = new THREE.Mesh(geometry, materials);
        mesh.geometry.center(); // 中央揃え
        mesh.position.y = -index * lineHeight;
        group.add(mesh);
      });

      // スケーリングとセンタリング (カメラのFOVに基づく)
      
      const box = new THREE.Box3().setFromObject(group);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const camera = cameraRef.current!;
      const vFOV = (camera.fov * Math.PI) / 180; // convert to radians
      const viewHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
      const viewWidth = viewHeight * camera.aspect;

      const margin = 0.9;
      const scaleX = (viewWidth * margin) / size.x;
      const scaleY = (viewHeight * margin) / size.y;
      const scale = Math.min(scaleX, scaleY);

      group.scale.set(scale, scale, scale);
      group.position.set(-center.x * scale, -center.y * scale, 0);

      scene.add(group);
      scene.userData.textGroup = group;

    }, 30);

    return () => clearTimeout(timeout);
  }, [text]);

  console.log(text);

  return (
    <div ref={containerRef} className="w-screen h-screen relative" id="three-canvas">
      <div className="absolute top-0 left-0 p-4 text-sm text-white font-mono bg-transparent z-10 whitespace-pre-line">
      {text}
    </div>

    <div
      className="absolute bottom-10 right-20 p-4 text-sm text-white font-mono bg-transparent z-10 text-right"
      style={{
        transform: 'rotate(90deg)',
        transformOrigin: 'bottom right',
      }}
    >
      <p>notWork-02.daichikawashima.com</p>
    </div>
    
    </div>
  );
}