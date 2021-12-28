import { Flow, FlowKey, FlowNetwork, Keys } from '../lib';
import debug from 'debug';
const debugLog = debug('Test');

const key0: FlowKey = {
  keyID: 0,
  private: 'b456bc1273380930d7839559c8026d3ba8e6418b9d040bd7021f1eb8d67bcf75',
  public: 'a6a1f28c43c89e8d04643378c93da88b52bf09c862d30a957ee403f1e7d3a6ab3723427c2bae6d13ec019e9ef892f0130caab47cae0da6b8da68f98be95d47fe',
};
const flow = new Flow(FlowNetwork.EMULATOR, '0xf8d6e0586b0a20c7', [key0], 5);

let newTestAccount = '';
let newTestAccount2 = '';
const newTestKeys: Keys = {
  private: 'e15abdfb61b936bc327db72d51279207263ec6630a56f30dbf3ecb56f58316e1',
  public: 'f70d48c7b8fd06436a166bb3c9fd59be2b629d572a7ec01ea5389fd8a4cb7bad3922ef0313c484b0073b0a759ce4aa899371831670a2dc52848e441b29fda06d',
};

export const runTests = async () => {
  debugLog('Beginning Tests');
  await connectionTest();
  await getAccountTest();
  await getAccountStressTest();
  await getBlockTest();
  await createAccountTest();
  await executeTransactionTest();
  flow.stop();
};

export const connectionTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test Connection');
    dbg('Beginning Test');
    try {
      await flow.start();
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const getAccountTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.get_account');
    dbg('Beginning Test');
    try {
      const account = await flow.get_account('0xf8d6e0586b0a20c7');
      if (account instanceof Error) return Promise.reject(account);
      dbg('Account:', account.address.toString('hex'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const getAccountStressTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Stress test get_account');
    dbg('Beginning Test');
    try {
      const testArray: Promise<any>[] = [];
      let i = 0;
      while (i++ < 100) {
        testArray.push(new Promise(async (e) => {
          const account = await flow.get_account('0xf8d6e0586b0a20c7');
          if (account instanceof Error) return Promise.reject(account);
          e(account);
        }));
      }
      await Promise.all(testArray);
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

// the following is not implemented for flow emulator
//
/* export const getAccountAtBlockHeightTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.get_account with block_height');
    dbg('Beginning Test');
    try {
      const account = await flow.get_account('0xf8d6e0586b0a20c7', 0); // checking account at height 0
      if (account instanceof Error) return Promise.reject(account);
      dbg('Account:', account.address.toString('hex'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
}; */

export const getBlockTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.get_block');
    dbg('Beginning Test');
    try {
      const latestBlock = await flow.get_block();
      if (latestBlock instanceof Error) return Promise.reject(latestBlock);
      dbg('Latest block:', latestBlock.id.toString('hex'));
      dbg('Block height:', latestBlock.height);
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const createAccountTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.create_account');
    dbg('Beginning Test');
    try {
      const newAccount = await flow.create_account([newTestKeys.public]);
      if (newAccount instanceof Error) return Promise.reject(newAccount);
      newTestAccount = newAccount.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value;
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const executeTransactionTest = async (): Promise<Boolean | Error> => {
  const simpleTransaction = `
    transaction(greeting: String) {

      let guest: String
    
      prepare(authorizer: AuthAccount) {
        self.guest = authorizer.address.toString()
      }
    
      execute {
        log(greeting.concat(",").concat(self.guest))
      }
    }
  `;
  const doubleAuthz = `
  transaction(greeting: String, greeting2: String) {

    let guest: String
    let guest2: String
  
    prepare(authorizer: AuthAccount, authorizer2: AuthAccount) {
      self.guest = authorizer.address.toString()
      self.guest2 = authorizer2.address.toString()
    }
  
    execute {
      log(greeting.concat(",").concat(self.guest).concat(",").concat(greeting2).concat(",").concat(self.guest2))
    }
  }
  `;
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.execute_transaction');
    dbg('Beginning Test');
    try {
      const newAccount = await flow.create_account([newTestKeys.public]);
      if (newAccount instanceof Error) return Promise.reject(newAccount);
      newTestAccount2 = newAccount.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value;
      // test simple transaction, proposed and paid by the pre-defined service account
      await flow.execute_transaction(simpleTransaction, ['hello']);
      // test simple transaction, proposed and paid by the newTestAccount
      const prop = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const prop2 = {
        address: Buffer.from(newTestAccount2.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      await flow.execute_transaction(simpleTransaction, ['world'], prop, prop, [prop]);
      // test simple transaction proposed by the newTestAccount, paid by the serviceAccount
      await flow.execute_transaction(simpleTransaction, ['world'], prop, undefined, [prop]);
      // test double authorizer transaction
      await flow.execute_transaction(doubleAuthz, ['hello', 'world'], prop, undefined, [prop, prop2]);

      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

runTests();
