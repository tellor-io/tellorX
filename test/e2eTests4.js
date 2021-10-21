const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const BN= require('bignumber.js');

describe("End-to-End Tests - Four", function() {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
    const BIGWALLET = "0xf977814e90da44bfa03b6295a0616a897441acec";
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac,parachute,govBig,govTeam
    let govSigner = null

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13147399
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
    controller = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await governance.deployed();
    await oracle.deployed();
    await treasury.deployed();
    await controller.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
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
    await tellor.init()
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance.address]}
    )
    await accounts[1].sendTransaction({to:governance.address,value:ethers.utils.parseEther("1.0")});
    govSigner = await ethers.provider.getSigner(governance.address);
  });
  it("stake enough reporters to prove disputeFee hits minimum [ @skip-on-coverage ]", async function() {
    await govBig.transfer(DEV_WALLET,await tellor.balanceOf(BIGWALLET))
    let wallet
    console.log("this may take a minute...")
    for(var i=1;i<=220;i++){
        wallet = await ethers.Wallet.createRandom().connect(ethers.provider);
        n=i%5
        await accounts[n].sendTransaction({to:wallet.address,value:ethers.utils.parseEther(".7")});
        await tellor.transfer(wallet.address,web3.utils.toWei("100"));
        tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, wallet);
        await tellorUser.depositStake();
    }
    await governance.updateMinDisputeFee();
    assert(await governance.disputeFee() == web3.utils.toWei("15"), "dispute fee should be at a minimum")
  })
  it("Nobody votes on reporter dispute", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let dispFee = await governance.disputeFee()
    let initBalReporter = await tellor.balanceOf(accounts[1].address)
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/testing/TestGovernance.sol:TestGovernance",governance.address, accounts[2]);
    await governance.beginDispute(h.uintTob32(1),_t);
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
    await h.advanceTime(86400 * 2.5)
    h.expectThrow(governance.executeVote(1));//must be tallied
    await governance.tallyVotes(1)
    let voteVars = await governance.getVoteInfo(1)
    await h.expectThrow(governance.executeVote(1)); //must wait a day
    await h.advanceTime(86400 * 1.5)
    await governance.executeVote(1)
    h.expectThrow(governance.executeVote(1));//vote has alrady been executed
    let finalBalReporter = await tellor.balanceOf(accounts[1].address)
    let finalBalDisputer = await tellor.balanceOf(accounts[2].address)
    dispFee = dispFee / 10
    assert(finalBalDisputer == initBalDisputer - dispFee)
    assert(initBalReporter - finalBalReporter == 0)
  })
  it("Ensure unlockDisputeFee is not possible if another round has started", async function() {
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("1000"));
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    await tellorUser.depositStake();
    oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
    await oracle.submitValue(h.uintTob32(1),300,0,'0x');
    let dispFee = await governance.disputeFee()
    let initBalReporter = await tellor.balanceOf(accounts[1].address)
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    governance = await ethers.getContractAt("contracts/testing/TestGovernance.sol:TestGovernance",governance.address, accounts[2]);
    await governance.beginDispute(h.uintTob32(1),_t);
    let _hash = ethers.utils.solidityKeccak256(['bytes32','uint256'], [h.uintTob32(1),_t])
    await h.advanceTime(86400 * 2.5)
    h.expectThrow(governance.executeVote(1));//must be tallied
    await governance.tallyVotes(1)
    let voteVars = await governance.getVoteInfo(1)
    await h.expectThrow(governance.executeVote(1)); //must wait a day
    await governance.beginDispute(h.uintTob32(1),_t);
    await h.expectThrow(governance.executeVote(1));
    await h.advanceTime(86400 * 1.5)
    await h.expectThrow(governance.executeVote(1));
    await h.advanceTime(86400 * .5)
    await govTeam.vote(2,true,false);
    await h.expectThrow(governance.executeVote(1));
    await governance.tallyVotes(2)
    await h.expectThrow(governance.executeVote(1));
    await h.expectThrow(governance.executeVote(2));
    await h.advanceTime(86400 * 2.5)
    await governance.executeVote(2);
  })
  it("Test delegate then delegates", async function() {
    this.timeout(20000000)
    let newController = await cfac.deploy(governance.address, oracle.address, treasury.address);
    await newController.deployed();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await governance.delegate(DEV_WALLET);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    await governance.delegate(DEV_WALLET);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    for(i=3;i<=5;i++){
        await tellor.transfer(accounts[i].address,web3.utils.toWei("200"));
        governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[i]);
        await governance.delegate(DEV_WALLET);
    }
    await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
    await h.expectThrow(governance.vote(1,true,false));//cannot vote if delegated
    devGovernance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, devWallet);
    await devGovernance.voteFor([accounts[1].address],1,true,false);
    assert(await governance.didVote(1,accounts[1].address),"user should have voted")
    let myArr = [accounts[3].address,accounts[4].address,accounts[5].address]
    await devGovernance.voteFor(myArr,1,false,true)
    assert(await governance.didVote(1,accounts[3].address),"user3 should have voted")
    assert(await governance.didVote(1,accounts[4].address),"user4 should have voted")
    assert(await governance.didVote(1,accounts[5].address),"user5 should have voted")
    assert(await governance.didVote(1,DEV_WALLET) == false, "dev wallet should not have voted")
    await devGovernance.delegate(accounts[1].address)
    await governance.proposeVote(governance.address,0x3c46a185,newController.address,0)
    await h.expectThrow(devGovernance.vote(2,false,true))
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
    let myArr2 = [DEV_WALLET]
    await governance.voteFor(myArr2,2,false,true)
    assert(await governance.didVote(2,accounts[3].address) == false,"user3 should not have voted")
    assert(await governance.didVote(2,accounts[4].address) == false,"user4 should not have voted")
    assert(await governance.didVote(2,accounts[5].address) == false ,"user5 should not have voted")
    assert(await governance.didVote(2,DEV_WALLET), "dev wallet should have voted")
    await devGovernance.voteFor(myArr,2,false,true)
    assert(await governance.didVote(2,accounts[3].address),"user3 should have voted")
    assert(await governance.didVote(2,accounts[4].address),"user4 should have voted")
    assert(await governance.didVote(2,accounts[5].address),"user5 should have voted")
    })
    it("Have and print dispute costs by number of ID's disputed and disputeRounds [ @skip-on-coverage ]", async function() {
        tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
        await tellor.changeUint(h.hash("_TARGET_MINERS"),1)
        tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
        await governance.updateMinDisputeFee();
        assert(await governance.disputeFee()*1 - web3.utils.toWei("15") == 0, "dispute fee should be at a minimum")
        await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
        await tellor.transfer(accounts[2].address,web3.utils.toWei("10000"));
        tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
        await tellorUser.depositStake();
        oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[1]);
        await oracle.submitValue(h.uintTob32(1),300,0,'0x');
        let disputerBal1 = await tellor.balanceOf(accounts[2].address)
        let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
        governance = await ethers.getContractAt("contracts/testing/TestGovernance.sol:TestGovernance",governance.address, accounts[2]);
        await governance.beginDispute(h.uintTob32(1),_t);
        let disputerBal2 = await tellor.balanceOf(accounts[2].address)
        assert(1*(disputerBal1 - disputerBal2 ) - web3.utils.toWei("15") < web3.utils.toWei(".0005"), "dispute fee should be correct 1")
        await h.advanceTime(86400 * 2.5)
        await governance.tallyVotes(1)
        await governance.beginDispute(h.uintTob32(1),_t);
        let disputerBal3 = await tellor.balanceOf(accounts[2].address)
        assert(disputerBal2 - disputerBal3 - web3.utils.toWei("15") * 2 < web3.utils.toWei(".005"), "dispute fee should be correct2")
        await h.advanceTime(86400 * 2.5)
        await governance.tallyVotes(2)
        await governance.beginDispute(h.uintTob32(1),_t);
        let disputerBal4 = await tellor.balanceOf(accounts[2].address)
        assert(disputerBal3 - disputerBal4 - web3.utils.toWei("15") * 4 < web3.utils.toWei(".005"), "dispute fee should be correct3")
        await h.advanceTime(86400 * 2.5)
        await governance.tallyVotes(3)
        await governance.beginDispute(h.uintTob32(1),_t);
        let disputerBal5 = await tellor.balanceOf(accounts[2].address)
        assert(disputerBal4 - disputerBal5 - web3.utils.toWei("15") * 8 < web3.utils.toWei(".005"), "dispute fee should be correct4")
        let c1 = (disputerBal1 - disputerBal2)/web3.utils.toWei("15")
        let c2 = (disputerBal2 - disputerBal3)/web3.utils.toWei("15")
        let c3 = (disputerBal3 - disputerBal4)/web3.utils.toWei("15")
        let c4 = (disputerBal4 - disputerBal5)/web3.utils.toWei("15")
        console.log("Dispute Round Costs -- Multiplier from orig disputeFee")
        console.log("Round 1 : ", c1)
        console.log("Round 2 : ", c2)
        console.log("Round 3 : ", c3)
        console.log("Round 4 : ", c4)
        console.log()
        await tellor.transfer(accounts[2].address,web3.utils.toWei("1000"));
        for(var i=3;i<=6;i++){
            await tellor.transfer(accounts[i].address,web3.utils.toWei("100"));
            tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[i]);
            await tellorUser.depositStake();
            oracle = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",oracle.address, accounts[i]);
            nonce = await oracle.getTimestampCountById(h.uintTob32(1));
            await oracle.submitValue(h.uintTob32(1),300,nonce,'0x');
        }
        disputerBal1 = await tellor.balanceOf(accounts[2].address)
        let _maxIn = await oracle.getTimestampCountById(h.uintTob32(1))  - 1
        _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),_maxIn);
        await governance.beginDispute(h.uintTob32(1),_t);
        disputerBal2 = await tellor.balanceOf(accounts[2].address)
        _maxIn = await oracle.getTimestampCountById(h.uintTob32(1))  - 1
        _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),_maxIn);
        await governance.beginDispute(h.uintTob32(1),_t);
        disputerBal3 = await tellor.balanceOf(accounts[2].address)
        _maxIn = await oracle.getTimestampCountById(h.uintTob32(1))  - 1
        _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),_maxIn);
        await governance.beginDispute(h.uintTob32(1),_t);
        disputerBal4 = await tellor.balanceOf(accounts[2].address)
        _maxIn = await oracle.getTimestampCountById(h.uintTob32(1))  - 1
        _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),_maxIn);
        await governance.beginDispute(h.uintTob32(1),_t);
        disputerBal5 = await tellor.balanceOf(accounts[2].address)
        c1 = (disputerBal1 - disputerBal2)/web3.utils.toWei("15")
        c2 = (disputerBal2 - disputerBal3)/web3.utils.toWei("15")
        c3 = (disputerBal3 - disputerBal4)/web3.utils.toWei("15")
        c4 = (disputerBal4 - disputerBal5)/web3.utils.toWei("15")
        console.log("Dispute Costs on Same ID -- Multiplier from orig disputeFee")
        console.log("2 disputes : ", c1)
        console.log("3 disputes : ", c2)
        console.log("4 disputes: ", c3)
        console.log("5 disputes : ", c4)
        console.log()
    })
    it("Calculate gas costs of using delegate array to vote (1, 10, 100, 200 delegates) [ @skip-on-coverage ]", async function() {
        await govBig.transfer(DEV_WALLET,await tellor.balanceOf(BIGWALLET))
        let wallet
        let delArr = []
        console.log("this may take a minute...")
        for(var i=1;i<=200;i++){
            wallet = await ethers.Wallet.createRandom().connect(ethers.provider);
            n=i%5
            await accounts[n].sendTransaction({to:wallet.address,value:ethers.utils.parseEther(".7")});
            await tellor.transfer(wallet.address,web3.utils.toWei("1"));
            governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, wallet);
            delArr.push(wallet.address);
            await governance.delegate(DEV_WALLET);
        }
        let newController = await cfac.deploy();
        await newController.deployed();
        governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
        await governance.delegate(DEV_WALLET);
        governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[1]);
        await governance.delegate(DEV_WALLET);
        await tellor.transfer(accounts[1].address,web3.utils.toWei("900"));
        await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,0)
        await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,1)
        await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,2)
        await governance.proposeVote(tellorMaster,0x3c46a185,newController.address,3)
        devGovernance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, devWallet);
        let initBal1 = await ethers.provider.getBalance(DEV_WALLET);
        await devGovernance.voteFor(delArr.slice(0),1,false,true)
        let initBal2 = await ethers.provider.getBalance(DEV_WALLET);
        await devGovernance.voteFor(delArr.slice(9),2,false,true)
        let initBal3 = await ethers.provider.getBalance(DEV_WALLET);
        await devGovernance.voteFor(delArr.slice(99),3,false,true)
        let initBal4 = await ethers.provider.getBalance(DEV_WALLET);
        await devGovernance.voteFor(delArr.slice(199),4,false,true)
        let initBal5 = await ethers.provider.getBalance(DEV_WALLET);
        console.log("Gas Costs -- Look at Reporter, max is 200 addresses")
        console.log()
        })
});
