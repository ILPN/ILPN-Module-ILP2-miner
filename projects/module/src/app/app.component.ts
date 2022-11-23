import {Component} from '@angular/core';
import {AlgorithmResult, AlphaOracleService, DropFile, FD_LOG, IlpplMinerService,
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

    public log: Array<Trace> | undefined;
    public resultFiles: Array<DropFile> = [];
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
        this.resultFiles = [];

        const algorithmProtocol = new AlgorithmResult("ILP miner");

        this.log = this._logParser.parse(files[0].content);
        console.debug(this.log);

        const concurrency = this._oracle.determineConcurrency(this.log);

        const poNets = this._logConverter.transformToPartialOrders(this.log, concurrency, {cleanLog: true, discardPrefixes: true});
        const pos = poNets.map(p => this._netToPo.transform(p.net));

        this._sub = this._miner.mine(pos).subscribe((r: NetAndReport) => {
            this.resultFiles = [new DropFile('model.pn', this._netSerializer.serialise(r.net))];
            this.processing = false;
        });
    }
}
