// Node.js module to read files from the filesystem 
import fs from 'fs'; 
// Node.js module to safely work with file paths across operating systems
import path from 'path'; 
import { PetriNet } from '../domain/petri-net'; 
import { Place } from '../domain/place'; 
import { Transition } from '../domain/transition'; 
import { Arc } from '../domain/arc'; 

// Loader class responsible for creating a PetriNet instance from a JSON file
export class PetriNetLoader {
    /**
     * Loads a Petri net definition form a JSON file and converts it into domain objects (Place, Transition, Arc)
     * @param filePath 
     * @returns 
     */
    loadFromFile (filePath: string): PetriNet {

        // Converts the given file path into an absolute path
        const absoluteFilePath = path.resolve(__dirname, filePath); 
        // Reads the content of the JSON file as a string
        const fileContent = fs.readFileSync(absoluteFilePath, 'utf-8'); 
        // Parse JSON string into a JavaScript object
        const jsonData = JSON.parse(fileContent); 

        // Converts each JSON "place" object into a Place domain object
        const places = jsonData.places.map((p: any) => new Place(p.id, p.label, p.tokens_number, p.position, p.role)); 
        // Converts each JSON "transition" object into a Transition domain object
        const transitions = jsonData.transitions.map((t: any) => new Transition(t.id, t.label, t.capability, t.position)); 
        // Converts each JSON "arc" object into an Arc domain object
        const arcs = jsonData.arcs.map((a:any) => new Arc(a.id, a.weight, a.from, a.to)); 
        // Create and return the PetriNet object
        return new PetriNet(places, transitions, arcs); 
    }

    // Saves the given Petri net model to a JSON file in the data folder with a timestamped filename
    saveToFile(petriNet: PetriNet): string {
        // Generate a timestamped filename for the saved model (e.g., "saved-petri-net-2024-06-01T12-30-45.json")
        const now = new Date(); // Get the current date and time
        const pad = (n: number) => n.toString().padStart(2, '0'); // Helper function to pad single-digit numbers with a leading zero
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1); // Months are zero-indexed in JavaScript, so we add 1
        const day = pad(now.getDate());
        const hour = pad(now.getHours());
        const min = pad(now.getMinutes());
        const sec = pad(now.getSeconds());
        const timestamp = `${year}-${month}-${day}T${hour}-${min}-${sec}`; // Construct the timestamp string in the format "YYYY-MM-DDTHH-MM-SS"
        const filename = `saved-petri-net-${timestamp}.json`; // Construct the filename using the timestamp

        // Build absolute path to the data folder
        const absoluteFilePath = path.resolve(__dirname, '../data', filename); 

        // Convert domain objects back to JSON-serializable format
        const jsonData = {
            // Map Place objects to JSON format
            places: petriNet.places.map(p => ({
                id: p.id,
                label: p.label,
                tokens_number: p.tokens,
                position: p.position,
                role: p.role
            })),
            // Map Transition objects to JSON format
            transitions: petriNet.transitions.map(t => ({
                id: t.id,
                label: t.label,
                capability: t.capability,
                position: t.position
            })),
            // Map Arc objects to JSON format
            arcs: petriNet.arcs.map(a => ({
                id: a.id,
                weight: a.weight,
                from: a.from,
                to: a.to
            }))
        };
        
        // Write the JSON data to the file 
        // null parameter means no replacer function, and 2 means pretty-print with 2 spaces indentation
        fs.writeFileSync(absoluteFilePath, JSON.stringify(jsonData, null, 2));
        
        // Return the filename
        return filename;
    }
}