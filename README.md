# Datacenter Planner

A web-based tool to convert 2D floorplans into interactive 3D scenes. Draw a floorplan in a 2D canvas using Paper.js, then switch to a 3D view powered by Three.js to add and manipulate 3D models (e.g., furniture like chairs, tables, racks and coolers).

https://github.com/user-attachments/assets/f8f9f8c5-0197-4fcf-b0da-fb947f87e825

## Features

- 2D Floorplan Creation: Draw walls and layouts on a 2D canvas.

- 3D Scene Rendering: Convert 2D floorplans into 3D scenes with a single click.

- Model Management: Add, delete, and transform 3D models using a dropdown menu.

- Export Capability: Export the 3D scene for further use.

- Interactive Controls: Use OrbitControls for navigation and TransformControls for model manipulation.

## Prerequisites

- Node.js (version 16 or higher recommended)
- npm (comes with Node.js)
- A modern web browser (e.g., Chrome, Firefox, Edge)

# Installation

Clone the Repository:

```bash

git clone https://github.com/your-username/datacenter-planner.git
cd datacenter-planner
```

Install Dependencies:
Run the following command to install the required dependencies (including Three.js and Vite):

```bash

npm install
```

## Running the Application

Start the Development Server:

Use the start script to launch the Vite development server:

```bash

npm start
```

Access the webpage:
Open your browser and navigate to http://localhost:5173 (or the port shown in the terminal). The tool will load, displaying the 2D canvas for drawing floorplans.

### Build the App and preview

Build and preview the app for production using Vite:

```bash
npm run build
npm run preview
```

Files are now bundled by default into the [dist](/dist/) folder.

## JSDoc

Generate automatic documentation based on the `jsdoc.json` configuration:

```bash
npm run doc
```

Check the generated documentation using a local server like live-server:

```
npm install -g live-server
live-server docs
```

# Development

To format the code before committing:

```bash
npm run format
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to get started.
