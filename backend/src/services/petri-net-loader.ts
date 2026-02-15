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
}