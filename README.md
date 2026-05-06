# VR Environment for Petri Net Modeling, Execution, and Robot Behavior Visualization

An interactive Petri net editor with connected robot avatar for bachelor thesis. The project combines a WebXR and Three.js-based 3D interface with an Angular frontend and a TypeScript/Express backend so users can build and execute Petri nets in VR directly from the browser. The scene also includes a robot avatar that is connected to the modeled workflow and reacts to selected transition capabilities.

## What it does

This application lets you create places and transitions in 3D space, connect them with arcs, edit their properties, fire enabled transitions, observe the resulting avatar behavior in VR and save the current model back to JSON.

The interface is designed for two interaction styles:

- Desktop mode with mouse and OrbitControls
- VR mode with WebXR controllers using headset or emulator in the browser

In addition to the Petri net, the application renders a robot avatar inside the same scene. The robot is linked to the modeled task flow through transition capabilities, so fired transitions can trigger robot movement or visual feedback in the 3D scene.

## Core Features

- Load and visualize existing Petri net JSON definitions
- Create places and transitions directly in the scene
- Connect elements with directed arcs
- Delete places, transitions, and arcs
- Edit element properties (labels, tokens, roles, capabilities, and arc weights)
- Fire enabled transitions and observe token movement
- Reset the model to the initial Petri net
- Save the current model to a timestamped JSON file
- Use the same application in desktop browsers or WebXR-compatible VR setups
- Display a robot avatar in the 3D scene
- Trigger robot reactions from transition capabilities such as movement and end-effector feedback

## Tech Stack

- Frontend: Angular, Three.js, ThreeMeshUI, TypeScript
- Backend: Node.js, Express, TypeScript
- Data format: JSON-based Petri net definitions
- VR support: WebXR
- Robot visualization: URDF-based robot avatar rendered in Three.js

## Project Structure

- backend contains the Express API, Petri net engine, loader, and JSON data files
- frontend contains the Angular app, 3D scene, VR UI, robot visualization

## Getting Started

### Prerequisites

- Node.js 20 or newer is recommended
- npm
- A modern browser for desktop use
- A WebXR-compatible browser and headset if you want to use VR mode

### 1. Install dependencies

Install backend and frontend dependencies separately:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start the backend

The backend serves the Petri net API on port 3000:

```bash
cd backend
npm run dev
```

### 3. Start the frontend

For this project, start the frontend with the VR-friendly command so the app is reachable from other devices on the same network:

```bash
cd frontend
BACKEND_HOST=$(ipconfig getifaddr en0):3000 ng serve --host 0.0.0.0 --ssl true --proxy-config proxy.conf.js
```

If your primary network interface is not `en0`, replace it with the correct interface name.

The app will typically be available at `https://localhost:4200/`.

## How To Use

When the app opens, it loads the current Petri net from the backend and renders it in 3D.

Use the control panel to:

- Fire currently enabled transitions
- Reset the simulation
- Enter modeling modes to create places, create transitions, connect elements, delete elements, edit element properties, and save the model

In modeling modes, click or point at the scene to place new elements or select existing ones. In edit mode, select an element to open the property panel and modify its values with the built-in virtual keyboard.

The robot avatar is shown in the same scene as the Petri net. When a fired transition has a matching capability, the robot can react visually, for example by moving toward an output place or by flashing the end-effector color.

## Backend API

The backend exposes a REST API under `/api/petri` for:

- Reading the current Petri net state
- Querying and firing transitions
- Creating, updating, and deleting places, transitions, and arcs
- Resetting the simulation
- Saving the current model to a JSON file

## Data and Persistence

The backend starts from a bundled example Petri net in the backend data folder. Saved models are written back into the backend data directory as timestamped JSON files such as `saved-petri-net-YYYY-MM-DDTHH-MM-SS.json`.

## Thesis Context

This project was built as part of a bachelor thesis to explore how Petri nets can be modeled and simulated in an interactive environment. The goal is to make robot behavior easier to understand by combining formal process modeling with direct manipulation in 3D, VR, and a robot visualization context.

## Notes

- The backend listens on `0.0.0.0`, which makes it reachable from other devices on the same network if needed
- The frontend uses an Angular proxy configuration to forward `/api` requests to the backend during development
- The robot avatar is implemented as a URDF-based visualization element and is synchronized with selected transition capabilities
