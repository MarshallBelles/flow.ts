import { Flow, FlowKey, FlowNetwork } from '../lib';
import debug from 'debug';
const debugLog = debug('Test');

const key0: FlowKey = {
  keyID: 0,
  private: '324db577a741a9b7a2eb6cef4e37e72ff01a554bdbe4bd77ef9afe1cb00d3cec',
};
const flow = new Flow(FlowNetwork.EMULATOR, '0xf8d6e0586b0a20c7', [key0]);

export const runTests = async () => {
  debugLog('Beginning Tests');
  await connectionTest();
  await getAccountTest();
  await getAccountStressTest();
  await getBlockTest();
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

runTests();
