import {Component} from '@angular/core';
import {AlgorithmResult, AlphaOracleService,
    BranchingProcessFoldingService, DropFile, FD_LOG, FD_PETRI_NET, Ilp2MinerService,
    LogToPartialOrderTransformerService,
    NetAndReport,
    PartialOrder, PetriNetSerialisationService, PartialOrderToPetriNetTransformerService, Trace, XesLogParserService} from 'ilpn-components';
import { Subscription } from 'rxjs';
import {FormControl} from '@angular/forms';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {

    public fdLog = FD_LOG;
    public fdPN = FD_PETRI_NET;

    public logLoaded = false;
    public pnResult: DropFile | undefined = undefined;
    public reportResult: DropFile | undefined = undefined;
    public processing = false;
    public fcThreshold = new FormControl(1);

    private _sub: Subscription | undefined;

    constructor(private _logParser: XesLogParserService,
                private _netSerializer: PetriNetSerialisationService,
                private _miner: Ilp2MinerService,
                private _oracle: AlphaOracleService,
                private _logConverter: LogToPartialOrderTransformerService,
                protected _poToPnTransformer: PartialOrderToPetriNetTransformerService,
                private _foldingService: BranchingProcessFoldingService) {
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }

    public processLogUpload(files: Array<DropFile>) {
        this.processing = true;
        this.pnResult = undefined;

        let log: Array<Trace> | undefined = this._logParser.parse(files[0].content);
        this.logLoaded = true;
        // console.debug(log);

        const lines = [`number of traces: ${log.length}`];

        const concurrency = this._oracle.determineConcurrency(log);

        let pos: Array<PartialOrder> | undefined = this._logConverter.transformToPartialOrders(log, concurrency, {cleanLog: true, discardPrefixes: true});
        log = undefined;

        lines.push(`number of partial orders: ${pos.length}`);
        lines.push(`number of traces contained in partial orders, after prefixes were discarded ${pos!.reduce((acc, a) => acc + a.frequency!, 0)}`);

        pos!.sort((a, b) => a.frequency! - b.frequency!);
        const i = pos!.findIndex(a => a.frequency! >= (this.fcThreshold.value ?? 1))
        pos?.splice(0, i);

        if ((this.fcThreshold.value ?? 1) > 1) {
            lines.push(`number of partial orders containing at least ${this.fcThreshold.value} traces: ${pos!.length}`)
            lines.push(`number of traces contained in these partial orders ${pos!.reduce((acc, a) => acc + a.frequency!, 0)}`);
        }

        const bp = this._foldingService.foldPartialOrders(pos.map(po => this._poToPnTransformer.transform(po)));
        pos = undefined;

        const start = performance.now();
        this._sub = this._miner.mine(bp).subscribe((r: NetAndReport) => {
            const stop = performance.now();

            const report = new AlgorithmResult('ILP² miner', start, stop);
            lines.forEach(l => report.addOutputLine(l));
            r.report.forEach(l => report.addOutputLine(l));
            this.pnResult = new DropFile('model.pn', this._netSerializer.serialise(r.net));
            this.reportResult = report.toDropFile('report.txt');
            this.processing = false;
        });
    }
}
