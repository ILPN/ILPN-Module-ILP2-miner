/// <reference lib="webworker" />
import {getSolverSubject, IlpplMinerService, NetAndReport, PartialOrderParserService, PetriNetSerialisationService} from 'ilpn-components';


addEventListener('message', ({data}) => {
    console.debug(data);
    getSolverSubject(solver$ => {
        const deserializer = new PartialOrderParserService();
        const pos = data.pos.map((po: string) => deserializer.parse(po));

        const start = performance.now();
        IlpplMinerService.mineWithSolver(pos, solver$).subscribe((r: NetAndReport) => {
            const stop = performance.now();
            const serializer = new PetriNetSerialisationService();
            postMessage({net: serializer.serialise(r.net), report: r.report, start, stop});
        });
    })
});
