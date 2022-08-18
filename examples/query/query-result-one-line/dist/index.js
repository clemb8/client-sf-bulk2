"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsforce_1 = __importDefault(require("jsforce"));
const client_sf_bulk2_1 = require("client-sf-bulk2");
function submitBulkQueryJob() {
    return __awaiter(this, void 0, void 0, function* () {
        const conn = new jsforce_1.default.Connection({});
        yield conn.login('clem.boschet@wise-fox-1pg4xo.com', 'password(56)gqgYhBHqi7FsXh9EUye8Vnoc');
        const bulkParameters = {
            accessToken: conn.accessToken,
            apiVersion: '55.0',
            instanceUrl: conn.instanceUrl
        };
        try {
            const bulkAPI = new client_sf_bulk2_1.BulkAPI(bulkParameters);
            const queryInput = {
                query: 'Select Id, Name from Account',
                operation: 'query'
            };
            const response = yield bulkAPI.submitAndGetQueryResults(queryInput, 10);
            console.log(response);
        }
        catch (ex) {
            console.log(ex);
        }
    });
}
submitBulkQueryJob();
//# sourceMappingURL=index.js.map