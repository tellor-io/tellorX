const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Six", function() {
    
  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam,oracle, oldTellorInstance
  let govSigner = null
  let disputeHash
  
  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13037866

          },},],
      });
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DEV_WALLET]}
    )
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [PARACHUTE]}
    )
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BIGWALLET]}
    )
        //Steps to Deploy:
        //Deploy Governance, Oracle, Treasury, and Controller. 
        //Fork mainnet Ethereum, changeTellorContract to Controller
        //run init in Controller

    oldTellorInstance = await ethers.getContractAt("contracts/tellor3/ITellor.sol:ITellor", tellorMaster)
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
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)

    await master.depositStake()

    /**
     * 
     * 
     * BEGIN SETUP MODIFICATION
     */
    
    //create 5 miners and a disputer
    let miners, m1, m2, m3, m4, m5, d1
    [m1, m2, m3, m4, m5, d1] = await ethers.getSigners()
    miners = [m1, m2, m3, m4, m5] 
    console.log('miners: ', miners);
    for (i = 0; i < miners.length; i++) {
        miner = miners[i]
        //transfer dev tokens to miners
        console.log(1)
        await oldTellorInstance.connect(devWallet).transfer(miner.address, BigInt(500E18))
        console.log(2);
        //stake 5 miners
        await oldTellorInstance.connect(miner).depositStake()
        console.log(3);
    }

    //fund disputer
    await oldTellorInstance.connect(devWallet).transfer(d1.address, BigInt(500E18))

    //skip 15 minutes
    await h.advanceTime(15*60)
    //submit values
    count = 0
    console.log(miners.length)
    for (i = 0; i < miners.length; i++) {
        count++
        console.log('count: ', count);
        miner = miners[i]
        // console.log(4);
        let currVars = await oldTellorInstance.getNewCurrentVariables()
        await oldTellorInstance.connect(miner).submitMiningSolution(
            "nonce", 
            currVars[1],
            [1, 1, 1, 1, 1]
        )
        await h.advanceTime(15*60)
    }
    //disputer disputes a value
    let currVars = await oldTellorInstance.getNewCurrentVariables()
    console.log('currVars: ', Number(currVars[1][0]))
    let valueCount = await oldTellorInstance.getNewValueCountbyRequestId(1)
    valueCount--
    let timestamp = await oldTellorInstance.getTimestampbyRequestIDandIndex(1, valueCount)
    await oldTellorInstance.connect(d1).beginDispute(1, timestamp, 1)

    
    disputeHash = ethers.utils.soliditySha256( 
        ["string", "int256", "int256" ],
        [m3.address,Number(currVars[1][2]) , timestamp]
    )
    

    /**
     * 
     * END SETUP MODIFICATION
     */
    console.log(5);
    
    await master.proposeFork(controller.address);
    let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
    await master.vote(_id,true)
    master = await oldTellorInstance.connect(bigWallet)
    await master.vote(_id,true);
    await h.advanceTime(86400 * 8)
    await master.tallyVotes(_id)
    await h.advanceTime(86400 * 2.5)
    await master.updateTellor(_id)
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    parachute = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",PARACHUTE, devWallet);
    govTeam = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, devWallet);
    govBig = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",governance.address, bigWallet);
    await tellor.deployed();
    await tellor.init(governance.address,oracle.address,treasury.address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
    });


    it("Test dispute on old contract, then dispute on new contract", async function() {
        //should be able to read old dispute
        console.log(1)
        let disputeId = await oldTellorInstance.getDisputeIdByDisputeHash(disputeHash)
        console.log('disputeId: ', disputeId);

      
    })
});
