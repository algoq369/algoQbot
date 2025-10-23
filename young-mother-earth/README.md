# 🌍 The Young Mother Earth

A beautiful 3D Earth experience built with Three.js and GSAP, featuring cursor parallax and scroll-based camera animations.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Your Model
Place your `the_young_mother_earth.glb` file in the `public/` folder.

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📁 Project Structure

```
young-mother-earth/
├── public/
│   └── the_young_mother_earth.glb   # Your 3D model file
├── index.html                       # Main HTML file
├── main.js                         # Three.js scene and animations
├── package.json                    # Dependencies
└── README.md                       # This file
```

## ✨ Features

- **3D Earth Model**: Loads your custom GLB model
- **Cursor Parallax**: Earth responds to mouse movement
- **Scroll Animation**: Camera moves around Earth as you scroll
- **Smooth Animations**: Powered by GSAP
- **Responsive Design**: Works on all screen sizes
- **Fallback Model**: Shows a blue sphere if GLB fails to load
- **Performance Optimized**: Adaptive quality based on performance

## 🎨 Customization

### Changing Colors
Edit the lighting in `main.js`:
```js
const ambient = new THREE.AmbientLight(0x99ccff, 0.6); // Blue ambient
const dirLight = new THREE.DirectionalLight(0xffffff, 1.3); // White directional
```

### Adjusting Animation Speed
Modify the rotation speed:
```js
model.rotation.y += 0.0015; // Slower: 0.0005, Faster: 0.003
```

### Camera Movement
Edit the scroll timeline in `main.js` to change camera paths.

## 🚀 Deployment

### Deploy to Vercel
1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Deploy!

### Build for Production
```bash
npm run build
```

## 🛠 Technologies Used

- **Three.js**: 3D graphics and WebGL rendering
- **GSAP**: Smooth animations and scroll triggers
- **Vite**: Fast development server and build tool
- **GLTFLoader**: Loading 3D models

## 📝 Notes

- Make sure your GLB file is optimized for web (under 10MB recommended)
- The model should be centered at origin (0,0,0) for best results
- Supports both GLB and GLTF formats

## 🐛 Troubleshooting

**Model not loading?**
- Check that the file is in the `public/` folder
- Verify the filename matches exactly: `the_young_mother_earth.glb`
- Check browser console for error messages

**Performance issues?**
- The app automatically reduces quality on slower devices
- Try reducing the model complexity
- Check that hardware acceleration is enabled

**Animation not smooth?**
- Ensure you're using a modern browser with WebGL support
- Try reducing the pixel ratio in `main.js`

---

Made with ❤️ for the beautiful planet we call home.
