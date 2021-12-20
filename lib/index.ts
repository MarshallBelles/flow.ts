import debug from 'debug';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Buffer } from 'buffer';
const encode = require('@onflow/encode');
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';
const ec: EC = new EC('p256');

const produceSignature = (privateKey: string, msg: Buffer): string => {
  const key = ec.keyFromPrivate(Buffer.from(privateKey, 'hex'));
  const sig = key.sign(sha3_256(msg));
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, 'be', n);
  const s = sig.s.toArrayLike(Buffer, 'be', n);
  return Buffer.concat([r, s]).toString('hex');
};

// eslint-disable-next-line camelcase
const sha3_256 = (msg: Buffer): string => {
  const sha = new SHA3(256);
  sha.update(msg);
  return sha.digest().toString('hex');
};

// eslint-disable-next-line no-unused-vars
export enum FlowNetwork {
  // eslint-disable-next-line no-unused-vars
  EMULATOR,
  // eslint-disable-next-line no-unused-vars
  TESTNET,
  // eslint-disable-next-line no-unused-vars
  MAINNET
}

// eslint-disable-next-line no-unused-vars
enum FlowWorkType {
  // eslint-disable-next-line no-unused-vars
  SCRIPT,
  // eslint-disable-next-line no-unused-vars
  TRANSACTION,
  // eslint-disable-next-line no-unused-vars
  GetLatestBlockHeader,
  // eslint-disable-next-line no-unused-vars
  GetBlockHeaderByID,
  // eslint-disable-next-line no-unused-vars
  GetBlockHeaderByHeight,
  // eslint-disable-next-line no-unused-vars
  GetLatestBlock,
  // eslint-disable-next-line no-unused-vars
  GetBlockByID,
  // eslint-disable-next-line no-unused-vars
  GetBlockByHeight,
  // eslint-disable-next-line no-unused-vars
  GetCollectionByID,
  // eslint-disable-next-line no-unused-vars
  GetTransaction,
  // eslint-disable-next-line no-unused-vars
  GetTransactionResult,
  // eslint-disable-next-line no-unused-vars
  GetAccountAtLatestBlock,
  // eslint-disable-next-line no-unused-vars
  GetAccountAtBlockHeight,
  // eslint-disable-next-line no-unused-vars
  GetEventsForHeightRange,
}

// eslint-disable-next-line no-unused-vars
enum FlowWorkerStatus {
  // eslint-disable-next-line no-unused-vars
  CONNECTING,
  // eslint-disable-next-line no-unused-vars
  IDLE,
  // eslint-disable-next-line no-unused-vars
  PROCESSING,
}

export interface FlowKey {
  keyID: number;
  private: string;
  public: string;
}

export interface Account {
  address: Buffer;
  balance: number;
  code: Buffer;
  keys: Array<AccountKey>;
  contracts: Object;
}

export interface Block {
  id: Buffer;
  parent_id: Buffer;
  height: number;
  timestamp: Timestamp;
  collection_guarantees: Array<CollectionGuarantee>;
  block_seals: Array<BlockSeal>;
  signatures: Array<Buffer>;
}

export interface Timestamp {
  // Represents seconds of UTC time since Unix epoch
  // 1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
  // 9999-12-31T23:59:59Z inclusive.
  seconds: number;

  // Non-negative fractions of a second at nanosecond resolution. Negative
  // second values with fractions must still have non-negative nanos values
  // that count forward in time. Must be from 0 to 999,999,999
  // inclusive.
  nanos: number;
}

export interface CollectionGuarantee {
  collection_id: Buffer;
  signatures: Array<Buffer>;
}

export interface BlockSeal {
  block_id: Buffer;
  execution_receipt_id: Buffer;
  execution_receipt_signatures: Array<Buffer>;
  result_approval_signatures: Array<Buffer>;
}

export interface AccountKey {
  id: number;
  public_key: Buffer,
  sign_algo: number;
  hash_algo: number;
  weight: number;
  sequence_number: number;
  revoked: Boolean;
}

export interface Transaction {
  script: Buffer;
  arguments: Array<Buffer>;
  reference_block_id: Buffer;
  gas_limit: number;
  proposal_key: TransactionProposalKey;
  payer: Buffer;
  authorizers: Array<Buffer>;
  payload_signatures: Array<TransactionSignature>;
  envelope_signatures: Array<TransactionSignature>;
}

export interface TransactionProposalKey {
  address: Buffer;
  key_id: number;
  sequence_number: number;
}

export interface TransactionSignature {
  address: Buffer;
  key_id: number;
  signature: Buffer;
}

export enum TransactionStatus {
  // eslint-disable-next-line no-unused-vars
  UNKNOWN,
  // eslint-disable-next-line no-unused-vars
  PENDING,
  // eslint-disable-next-line no-unused-vars
  FINALIZED,
  // eslint-disable-next-line no-unused-vars
  EXECUTED,
  // eslint-disable-next-line no-unused-vars
  SEALED,
  // eslint-disable-next-line no-unused-vars
  EXPIRED,
}

export interface Sign {
  address: string,
  key_id: number,
  private_key: string,
}

interface Sig {
  address: string;
  keyId: number;
  sig: string;
}

interface FlowWork {
  type: FlowWorkType;
  arguments: Array<any>;
  callback: Function;
  script?: Buffer;
  proposer?: Buffer;
  authorizers?: Array<Buffer>,
  payer?: Buffer;
  payload_signatures?: Array<Sign>,
}

const signTransaction = (transaction: Transaction, payloadSignatures: Sign[], envelopeSignatures: Sign[]): Transaction => {
  const debugLog = debug(`signTransaction`);

  const tr = transaction;
  const payloadSigs: Sig[] = [];
  payloadSignatures.forEach((ps) => {
    const payloadMsg = encode.encodeTransactionPayload({
      script: tr.script.toString('utf-8'),
      arguments: tr.arguments,
      refBlock: tr.reference_block_id.toString('hex'),
      gasLimit: tr.gas_limit,
      proposalKey: {
        address: tr.proposal_key.address.toString('hex'),
        keyId: tr.proposal_key.key_id,
        sequenceNum: tr.proposal_key.sequence_number,
      },
      payer: tr.payer.toString('hex'),
      authorizers: tr.authorizers.map((x) => x.toString('hex')),
    });
    const thisSig = produceSignature(ps.private_key, payloadMsg);
    tr.payload_signatures.push({ address: Buffer.from(ps.address, 'hex'), key_id: ps.key_id, signature: Buffer.from(thisSig, 'hex') });
    payloadSigs.push({ address: ps.address, keyId: ps.key_id, sig: thisSig });
  });
  envelopeSignatures.forEach((es) => {
    const envelopeMsg = encode.encodeTransactionEnvelope({
      script: tr.script.toString('utf-8'),
      arguments: tr.arguments,
      refBlock: tr.reference_block_id.toString('hex'),
      gasLimit: tr.gas_limit,
      proposalKey: {
        address: tr.proposal_key.address.toString('hex'),
        keyId: tr.proposal_key.key_id,
        sequenceNum: tr.proposal_key.sequence_number,
      },
      payer: tr.payer.toString('hex'),
      payloadSigs: payloadSigs,
      authorizers: tr.authorizers.map((x) => x.toString('hex')),
    });
    const thisSig = produceSignature(es.private_key, envelopeMsg);
    tr.envelope_signatures.push({ address: Buffer.from(es.address, 'hex'), key_id: es.key_id, signature: Buffer.from(thisSig, 'hex') });
  });
  debugLog(tr);
  return tr;
};

export class Flow {
  private serviceAccountAddress: string;
  private network: string;
  private privateKeys: Array<FlowKey> = [];
  private workers: Array<FlowWorker> = [];
  private work: Array<FlowWork> = [];
  private dbg: debug.IDebugger;
  private error: any;
  private shutdown: Boolean = false;
  private tickTimeout: number = 20;
  private processing: Boolean = false;

  constructor(network: FlowNetwork | string, serviceAccountAddress: string, privateKeys: Array<FlowKey>, tick?: number) {
    tick ? this.tickTimeout = tick : 20;
    this.dbg = debug('Flow');
    switch (network) {
      case FlowNetwork.EMULATOR:
        this.network = '127.0.0.1:3569';
        break;
      case FlowNetwork.TESTNET:
        this.network = 'access.devnet.nodes.onflow.org:9000';
        break;
      case FlowNetwork.MAINNET:
        this.network = 'access.mainnet.nodes.onflow.org:9000';
        break;

      default:
        this.network = network;
        break;
    }
    this.serviceAccountAddress = serviceAccountAddress.replace(/\b0x/g, '');
    this.privateKeys = privateKeys;
  }

  async start(): Promise<void> {
    this.dbg('Starting Flow.ts');
    this.dbg('Access Node:', this.network);
    this.dbg('Private Keys:', this.privateKeys.length);

    const processingConnections: Promise<any>[] = [];
    this.privateKeys.forEach((k) => {
      processingConnections.push(new Promise(async (p) => {
        const worker = new FlowWorker(k.private, k.public, k.keyID, this.network);
        await worker.connect();
        this.workers.push(worker);
        p(true);
      }));
    });
    await Promise.all(processingConnections);
    this.dbg('Workers:', this.workers.length);
    this.dbg('Flow.ts Ready');
    this.tick();
  }
  private async tick() {
    if (!this.processing) {
      this.processing = true;
      const beginningCount = this.work.length;
      if (beginningCount > 0) {
        this.workers.forEach((w) => {
          if (this.work.length > 0 && w.status == FlowWorkerStatus.IDLE) {
            w.process(this.work.splice(0, 1)[0]);
          }
        });
        if (this.work.length > 0) {
          this.dbg('All workers are busy, work remaining:', this.work.length);
        }
        if (this.shutdown) this.dbg('Cleaning up for shutdown');
      }
      if (this.error) console.log('Error:', this.error);
      this.processing = false;
    }
    if (!this.shutdown || this.work.length > 0) setTimeout(() => this.tick(), this.tickTimeout);
  }
  stop() {
    this.shutdown = true;
  }
  async get_account(accountAddress: string, blockHeight?: number): Promise<Account | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res['account']);
      };
      if (typeof blockHeight == 'number') {
        this.work.push({
          type: FlowWorkType.GetAccountAtBlockHeight,
          arguments: [accountAddress, blockHeight],
          callback: cb,
        });
      } else {
        this.work.push({
          type: FlowWorkType.GetAccountAtLatestBlock,
          arguments: [accountAddress],
          callback: cb,
        });
      }
    });
  }
  async execute_script(script: string, arg: any[]): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        this.dbg('execute_script response is:', res);
        p(res);
      };
      this.work.push({
        type: FlowWorkType.SCRIPT,
        script: Buffer.from(script, 'utf-8'),
        arguments: arg,
        callback: cb,
      });
    });
  }
  async execute_transaction(script: string, arg: any[]): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        this.dbg('execute_transaction response is:', res);
        p(res);
      };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(script, 'utf-8'),
        arguments: arg,
        callback: cb,
      });
    });
  }
  async create_account(newAccountKeys?: Array<FlowKey>): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };

      const createAccountTemplate = `
        transaction(publicKeys: [String], contracts: {String: String}) {
            prepare(signer: AuthAccount) {
                let acct = AuthAccount(payer: signer)
        
                for key in publicKeys {
                    acct.addPublicKey(key.decodeHex())
                }
        
                for contract in contracts.keys {
                    acct.contracts.add(name: contract, code: contracts[contract]!.decodeHex())
                }
            }
        }`;

      const keys: string[] = [];

      newAccountKeys ? newAccountKeys.map((x) => {
        if (x.public) keys.push(x.public);
      }) : this.privateKeys.map((x) => {
        if (x.public) keys.push(x.public);
      });

      const svcBuf = Buffer.from(this.serviceAccountAddress, 'hex');

      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(createAccountTemplate, 'utf-8'),
        arguments: [keys],
        proposer: svcBuf,
        payer: svcBuf,
        authorizers: [svcBuf],
        payload_signatures: [],
        callback: cb,
      });
    });
  }
  async get_block(blockId?: string, blockHeight?: number, sealed?: boolean): Promise<Block | Error> {
    const isSealed = sealed ? sealed : false;
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res['block']);
      };
      if (blockId) {
        this.work.push({
          type: FlowWorkType.GetBlockByID,
          arguments: [blockId, isSealed],
          callback: cb,
        });
      } else if (blockHeight) {
        this.work.push({
          type: FlowWorkType.GetBlockByHeight,
          arguments: [blockHeight, isSealed],
          callback: cb,
        });
      } else {
        this.work.push({
          type: FlowWorkType.GetLatestBlock,
          arguments: [isSealed],
          callback: cb,
        });
      }
    });
  }
}

class FlowWorker {
  privKey: string;
  pubKey: string;
  id: number;
  dbg: debug.IDebugger;
  private network: string;
  private access: any;
  private client: any;
  public status: number;
  constructor(privKey: string, pubKey: string, id: number, network: string) {
    const debugLog: debug.IDebugger = debug(`FlowWorker::${id}::Constructor`);
    this.dbg = debug(`FlowWorker::${id}`);
    this.privKey = privKey;
    this.pubKey = pubKey;
    this.id = id;
    this.network = network;
    this.status = FlowWorkerStatus.CONNECTING;
    debugLog('Worker registered');
    debugLog('Loading Protobufs');
    const packageDefinition = protoLoader.loadSync('flow.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.access = (<any>grpc.loadPackageDefinition(packageDefinition).flow)['access'];
  }
  async connect(): Promise<void> {
    return new Promise((p) => {
      this.dbg('Connecting');
      this.client = new this.access['AccessAPI'](this.network, grpc.credentials.createInsecure());
      this.client.ping({}, (err: any) => {
        if (err) {
          this.dbg('Error while connecting');
          return Promise.reject(Error('Could not establish connection'));
        } else {
          this.status = FlowWorkerStatus.IDLE;
          this.dbg('Connection success');
          p();
        }
      });
    });
  }
  process(work: FlowWork): Promise<void> {
    this.status = FlowWorkerStatus.PROCESSING;
    return new Promise(async (p) => {
      this.dbg('Processing', FlowWorkType[work.type]);
      // process the work
      switch (work.type) {
        case FlowWorkType.GetAccountAtLatestBlock:
          if (work.arguments.length == 1) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            this.client.getAccountAtLatestBlock({ address: bufArg }, (err: any, res: any) => {
              work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetAccountAtBlockHeight:
          if (work.arguments.length == 2) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            this.client.getAccountAtBlockHeight({ address: bufArg, block_height: parseInt(work.arguments[1]) }, (err: any, res: any) => {
              work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetLatestBlock:
          if (work.arguments.length == 1) {
            if (typeof work.arguments[0] !== 'boolean') return Promise.reject(Error(`arg 0 must be a bool: GetLatestBlock, found ${work.arguments[0]}`));
            this.client.getLatestBlock({ is_sealed: work.arguments[0] }, (err: any, res: any) => {
              work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.TRANSACTION:
          if (!work.proposer) return Promise.reject(Error('Transaction must have a proposer'));
          if (!work.payer) return Promise.reject(Error('Transaction must have a payer'));
          this.client.getLatestBlock({ is_sealed: work.arguments[0] }, (err: any, block: any) => {
            if (err) p(err);
            this.client.getAccountAtLatestBlock({ address: work.proposer }, (err: any, proposer: any) => {
              if (err) p(err);
              this.client.getAccountAtLatestBlock({ address: work.payer }, (err: any, payer: any) => {
                if (err) p(err);
                // args
                // build
                const mapR = proposer['account'].keys.map((x: AccountKey) => {
                  if (x.public_key.toString('hex') == this.pubKey.replace(/\b0x/g, '')) return [x.id, x.sequence_number];
                })[0];
                const propKey: TransactionProposalKey = {
                  address: proposer['account'].address,
                  key_id: mapR[0],
                  sequence_number: mapR[1],
                };
                let transaction: Transaction = {
                  script: work.script ? work.script : Buffer.from('', 'utf-8'),
                  arguments: [],
                  reference_block_id: block['block'].id,
                  gas_limit: 9999,
                  proposal_key: propKey,
                  payer: payer['account'].address,
                  authorizers: <Array<Buffer>>work.authorizers,
                  payload_signatures: [],
                  envelope_signatures: [],
                };
                // sign
                const sig: Sign = {
                  address: payer['account'].address.toString('hex'),
                  key_id: mapR[0],
                  private_key: this.privKey,
                };
                transaction = signTransaction(transaction, [], [sig]);
                // send
                this.client.sendTransaction({ transaction: transaction }, (err: any, trans: any) => {
                  work.callback(err, trans);
                  this.status = FlowWorkerStatus.IDLE;
                  p();
                });
              });
            });
          });
          break;

        default:
          this.dbg(FlowWorkType[work.type], 'is not implemented.');
          work.callback(Error(`${FlowWorkType[work.type]} is not implemented`));
          this.status = FlowWorkerStatus.IDLE;
          p();
          break;
      }
    });
  }
}
