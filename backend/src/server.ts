// Import the express framework (used to create the backend server)
import express from 'express';
// import cors middleware (allows requests from other origins like Angular)
import cors from 'cors'; 
import petriNetRoutes from './routes/petri-net-routes'; 

// Create an express application instance
const app = express(); 
// Define the port where the backend will run
const PORT = 3000; 


// Enable cors for all incoming requests
app.use(cors()); 
// Enable JSON parsing for incoming requests
app.use(express.json()); 

// Routes all requests starting with /api/petri to the Petri net route definitions
app.use('/api/petri', petriNetRoutes); 

// Start the server and listen on the defined port
app.listen(PORT, '0.0.0.0',() => { 
    console.log(`Backend running on http://localhost:${PORT}`);
}) 