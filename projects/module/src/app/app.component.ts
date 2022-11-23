import {Component} from '@angular/core';
import {AlgorithmResult, DropFile, FD_LOG,
    IlpMinerResult, IlpMinerService, PetriNetSerialisationService, Trace, XesLogParserService} from 'ilpn-components';
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
                private _miner: IlpMinerService) {
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

        this._sub = this._miner.mine(this.log).subscribe((r: IlpMinerResult) => {
            this.resultFiles = [new DropFile('model.pn', this._netSerializer.serialise(r.net))];
            this.processing = false;
        });
    }
}
