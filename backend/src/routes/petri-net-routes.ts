import { Router } from 'express'; 
import { PetriNetController } from '../controllers/petri-net-controller';
import { PetriNetEngine } from '../services/petri-net-engine';

// Create router instance
const router = Router(); 

// Create Petri net engine
const engine = new PetriNetEngine();
// Create controller with engine
const controller = new PetriNetController(engine); 

// Route to get Petri net state
router.get('/state', controller.getState); 
// Route to get fireable transitions
router.get('/fireableTransitions', controller.getFireableTransitions); 
// Route to check fireability
router.get('/isFireable/:id', controller.isFireableById); 
// Route to fire transition
router.post('/fireTransition/:id', controller.fireTransitionById); 
// Route to reset Petri net
router.post('/reset', controller.reset);
// Route to update place position
router.patch('/place/:id/position', controller.updatePlacePosition);
// Route to update transition position
router.patch('/transition/:id/position', controller.updateTransitionPosition);
// Route to create place
router.post('/place', controller.createPlace);
// Route to create transition
router.post('/transition', controller.createTransition);
// Route to create arc
router.post('/arc', controller.createArc);
// Route to delete place (also removes connected arcs)
router.delete('/place/:id', controller.deletePlace);
// Route to delete transition (also removes connected arcs)
router.delete('/transition/:id', controller.deleteTransition);
// Route to delete arc
router.delete('/arc/:id', controller.deleteArc);

export default router; 