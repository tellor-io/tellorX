const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("End-to-End Tests - One", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac
    let govSigner = null
  
  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:12762660
          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
        //Steps to Deploy:
        //Deploy Governance, Oracle, Treasury, and Controller. 
        //Fork mainnet Ethereum, changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor", tellorMaster)
    gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
    ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
    governance = await gfac.deploy();
    oracle = await ofac.deploy();
    treasury = await tfac.deploy();
    controller = await cfac.deploy();
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    master = await oldTellorInstance.connect(devWallet)
    await master.changeTellorContract(controller.address);
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("Mine 2 values on 50 different ID's", async function() {
    this.timeout(100000)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[4].address,web3.utils.toWei("200"));
    await tellor.transfer(oracle.address,web3.utils.toWei("200"));//funding the oracle for inflationary rewards
    for(i = 1;i<5;i++){
        tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[i]);
        oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[i]);
        await h.expectThrow(oracle.submitValue(h.uintTob32(1),150));//must be staked
        await tellorUser.depositStake();
    }
    let blockTimes = [0]
    let blocky, _id;
    for(_count=1; _count <= 100;_count++){
        if(_count > 50){
            _id = _count - 50;
        }
        else{
            _id = _count;
        }
        _i = _count % 4 + 1
        oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[_i]);
        await oracle.addTip(h.uintTob32(_id),_count*100)
        await oracle.submitValue(h.uintTob32(_id), (_count * 1000))
        blocky = await ethers.provider.getBlock();
        blockTimes.push(blocky.timestamp)
        await h.expectThrow(oracle.submitValue( ethers.utils.formatBytes32String("1"),150));//cannot submit twice in 12 hours
        await h.advanceTime(86400)
    }
    assert(await oracle.tipsInContract() == 0, "the tip should have been paid out")
    let _time;
    for(_count=1; _count <= 50;_count++){
        _time = blockTimes[_count]
        assert(await oracle.getValueByTimestamp(h.uintTob32(_count),_time)- _count * 1000 == 0, "value should be correct")
        assert(await oracle.getTipsById(h.uintTob32(_count)) == 0, "tips should be zeroed")
        assert(await oracle.getTimestampCountById(h.uintTob32(_count)) - 2 == 0, "timestamp count should be correct")  
        _count++
    }
    for(i = 1;i<5;i++){
        assert(await oracle.getReportsSubmittedByAddress(accounts[i].address) - 25 == 0, "reports by address should be correct")
    }
  });
});
