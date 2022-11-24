import {Component} from '@angular/core';
import {AlgorithmResult, AlphaOracleService, DropFile, FD_LOG, FD_PETRI_NET, IlpplMinerService,
    LogToPartialOrderTransformerService,
    NetAndReport, PetriNetSerialisationService, PetriNetToPartialOrderTransformerService, Trace, XesLogParserService} from 'ilpn-components';
import { Subscription } from 'rxjs';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {

    public fdLog = FD_LOG;
    public fdPN = FD_PETRI_NET;

    public log: Array<Trace> | undefined;
    public pnResult: DropFile | undefined = undefined;
    public reportResult: DropFile | undefined = undefined;
    public processing = false;

    private _sub: Subscription | undefined;

    constructor(private _logParser: XesLogParserService,
                private _netSerializer: PetriNetSerialisationService,
                private _miner: IlpplMinerService,
                private _oracle: AlphaOracleService,
                private _logConverter: LogToPartialOrderTransformerService,
                private _netToPo: PetriNetToPartialOrderTransformerService) {
    }

    ngOnDestroy(): void {
        this._sub?.unsubscribe();
    }

    public processLogUpload(files: Array<DropFile>) {
        this.processing = true;
        this.pnResult = undefined;

        this.log = this._logParser.parse(files[0].content);
        console.debug(this.log);

        const lines = [`number of traces: ${this.log.length}`];

        const concurrency = this._oracle.determineConcurrency(this.log);

        const poNets = this._logConverter.transformToPartialOrders(this.log, concurrency, {cleanLog: true, discardPrefixes: true});
        const pos = poNets.map(p => this._netToPo.transform(p.net));

        lines.push(`number of partial orders: ${pos.length}`);

        const start = performance.now();
        this._sub = this._miner.mine(pos).subscribe((r: NetAndReport) => {
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
