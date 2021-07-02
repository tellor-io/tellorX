const web3 = require('web3');
const BN = web3.utils.BN;

advanceTimeAndBlock = async (time) => {
    await advanceTime(time);
    await advanceBlock();
    console.log("Time Travelling...");
    return Promise.resolve(web3.eth.getBlock("latest"));
  };
  
const takeFifteen = async () => {
await advanceTime(60 * 18);
};
  
advanceTime = (time) => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [time],
          id: new Date().getTime(),
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          return resolve(result);
        }
      );
    });
  };
  
  advanceBlock = () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          id: new Date().getTime(),
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          const newBlockHash = web3.eth.getBlock("latest").hash;
  
          return resolve(newBlockHash);
        }
      );
    });
  };
  
  async function expectThrow(promise) {
    try {
      await promise;
    } catch (error) {
      const invalidOpcode = error.message.search("invalid opcode") >= 0;
      const outOfGas = error.message.search("out of gas") >= 0;
      const revert = error.message.search("revert") >= 0;
      assert(
        invalidOpcode || outOfGas || revert,
        "Expected throw, got '" + error + "' instead"
      );
      return;
    }
    assert.fail("Expected throw not received");
  }

  function to18(n) {
    return ethers.BigNumber.from(n).mul(ethers.BigNumber.from(10).pow(18))
  }
  
module.exports = {
  stakeAmount: new BN(web3.utils.toWei("500", "ether")),
  timeTarget: 240,
  zeroAddress:"0x0000000000000000000000000000000000000000",
  to18, 
  maxUint256: new BN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
  advanceTime,
  advanceBlock,
  advanceTimeAndBlock,
  takeFifteen,
  expectThrow,
};