import {Component} from '@angular/core';
import {AlgorithmResult, AlphaOracleService,
    BranchingProcessFoldingService, DropFile, FD_LOG, FD_PETRI_NET, Ilp2MinerService,
    LogToPartialOrderTransformerService,
    NetAndReport,
    PartialOrderNetWithContainedTraces, PetriNetSerialisationService, PetriNetToPartialOrderTransformerService, Trace, XesLogParserService} from 'ilpn-components';
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
    public fcThreshold: FormControl;

    private _sub: Subscription | undefined;

    constructor(private _logParser: XesLogParserService,
                private _netSerializer: PetriNetSerialisationService,
                private _miner: Ilp2MinerService,
                private _oracle: AlphaOracleService,
                private _logConverter: LogToPartialOrderTransformerService,
                private _netToPo: PetriNetToPartialOrderTransformerService,
                private _foldingService: BranchingProcessFoldingService) {
        this.fcThreshold = new FormControl(1);
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

        let poNets: Array<PartialOrderNetWithContainedTraces> | undefined = this._logConverter.transformToPartialOrders(log, concurrency, {cleanLog: true, discardPrefixes: true});
        log = undefined;

        lines.push(`number of partial orders: ${poNets.length}`);
        lines.push(`number of traces contained in partial orders, after prefixes were discarded ${poNets!.reduce((acc, a) => acc + a.net.frequency!, 0)}`);

        poNets!.sort((a,b) => a.net.frequency! - b.net.frequency!);
        const i = poNets!.findIndex(a => a.net.frequency! >= this.fcThreshold.value)
        poNets?.splice(0, i);

        if (this.fcThreshold.value > 1) {
            lines.push(`number of partial orders containing at least ${this.fcThreshold.value} traces: ${poNets!.length}`)
            lines.push(`number of traces contained in these partial orders ${poNets!.reduce((acc, a) => acc + a.net.frequency!, 0)}`);
        }

        const bp = this._foldingService.foldPartialOrders(poNets.map(pon => pon.net));
        poNets = undefined;

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
