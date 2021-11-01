const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("End-to-End Tests - One", function() {

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
  it("Mine 2 values on 50 different ID's", async function() {
    this.timeout(20000000)
    await tellor.transfer(accounts[1].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[3].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[4].address,web3.utils.toWei("200"));
    await tellor.transfer(oracle.address,web3.utils.toWei("200"));//funding the oracle for inflationary rewards
    for(i = 1;i<5;i++){
        tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[i]);
        oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[i]);
        nonce = await oracle.getTimestampCountById(h.uintTob32(1));
        await h.expectThrow(oracle.submitValue(h.uintTob32(1),150,nonce,'0x'));//must be staked
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
        await oracle.tipQuery(h.uintTob32(_id),_count*100,'0x')
        nonce = await oracle.getTimestampCountById(h.uintTob32(_id));
        await oracle.submitValue(h.uintTob32(_id), (_count * 1000), nonce,'0x')
        blocky = await ethers.provider.getBlock();
        blockTimes.push(blocky.timestamp)
        nonce = await oracle.getTimestampCountById(h.uintTob32(1));
        await h.expectThrow(oracle.submitValue( h.uintTob32(_id),150,nonce,'0x'));//cannot submit twice in 12 hours
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
  it("Parachute Tests -- rescue failed update", async function() {
    await expect(
      parachute.rescueFailedUpdate(),
      "tellor address should be valid"
    ).to.be.reverted
    await tellor.changeAddressVar(h.hash("_TELLOR_CONTRACT"),ethers.constants.AddressZero)
    let tellorContract = '0x0f1293c916694ac6af4daa2f866f0448d0c2ce8847074a7896d397c961914a08'
    await expect(
      tellor.getAddressVars(tellorContract),
      "shouldn't be able to read"
    ).to.be.reverted
    //throw deity to parachute
    await parachute.rescueFailedUpdate()
    //get it back!
    await tellor.changeTellorContract(controller.address)
    //read tellor contract adddress
    let newAdd = await tellor.getAddressVars(tellorContract)
    await assert(newAdd == controller.address, "Tellor's address was not updated")
  })

  it("Parachute Tests -- kill contract", async function() {
    await parachute.killContract()
    let deity = '0x5fc094d10c65bc33cc842217b2eccca0191ff24148319da094e540a559898961'
    let newDeity = await tellor.getAddressVars(deity)
    assert(newDeity == ethers.constants.AddressZero, "New deity is not multis")//should be zero addy
  })

  it("Parachute tests -- migrates tokens", async function() {
    //transfer tokens to the parachute
    //it will send these tokens to acc2 using the migrateFor function
    await tellor.transfer(parachute.address, 100)
    //create signer
    let acc2 = await ethers.getSigner()
    //acc2 does not have a balance yet
    assert(await tellor.balanceOf(acc2.address) ==  0, "should have 0");
    //migrate multis token locked in parachute to acc2
    await parachute.migrateFor(acc2.address, 1)
    //balance should be updated
    assert(await tellor.balanceOf(acc2.address) == 1, "should have 1")
    await expect(
      parachute.migrateFor(acc2.address, web3.utils.toWei("50000000")),
      "cannot send tokens it doesn't have"
    ).to.be.reverted
  })
  it("Must be able to migrate successfully", async function() {

    let NonMigratedAddy ="0x21db5e3000e1ef6f78f07c75bc00a0a3b2215cdc"
    oldTellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor","0x0Ba45A8b5d5575935B8158a88C631E9F9C95a2e5", accounts[1]);
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [NonMigratedAddy]}
    )
    const nonMigratedGuy = await ethers.provider.getSigner(NonMigratedAddy);
    await accounts[1].sendTransaction({to:NonMigratedAddy,value:ethers.utils.parseEther("1.0")});
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, nonMigratedGuy);
    let oldTellorBalance = await oldTellor.balanceOf(NonMigratedAddy)
    await tellor.migrate();
    await h.expectThrow(tellor.migrate());//should fail if run twice
    assert(await tellor.isMigrated(NonMigratedAddy), "address should be marked as migrated")
    assert(oldTellorBalance - await tellor.balanceOf(NonMigratedAddy) == 0, "balances should be the same")
    await parachute.migrateFor(accounts[1].address, web3.utils.toWei("100"))
    assert(await tellor.balanceOf(accounts[1].address) == web3.utils.toWei("100"), "should have migratedFor properly")
  })
  it("Staked miners should not be able to tip or get under their stake amount", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await tellorUser.requestStakingWithdraw()
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
  })
  it("Check reducing stake amount in the future", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    //vote to reduce the stakeAmount
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.proposeVote(tellorMaster,0x740358e6,ethers.utils.defaultAbiCoder.encode([ "bytes32","uint256" ],[h.hash("_STAKE_AMOUNT"),web3.utils.toWei("50")]),0)//changeUINT(hash(stakeAmount),50wei)
    await h.advanceTime(86400 * 8)
    await govTeam.vote(1,true,false);
    await govBig.vote(1,true,false);
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await governance.executeVote(1)
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == web3.utils.toWei("50"), "stake amount should change properly")
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),web3.utils.toWei("51"),'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,web3.utils.toWei("52")));//must have funds
    await tellorUser.transfer(accounts[4].address,web3.utils.toWei("50"))
  })
  it("Check reducing stake amount in the future2", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    //vote to reduce the stakeAmount
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
     await governance.proposeVote(tellorMaster,0x740358e6,ethers.utils.defaultAbiCoder.encode([ "bytes32","uint256" ],[h.hash("_STAKE_AMOUNT"),web3.utils.toWei("50")]),0)//changeUINT(hash(stakeAmount),50wei)
    await h.advanceTime(86400 * 8)
    await govTeam.vote(1,true,false);
    await govBig.vote(1,true,false);
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await oracle1.submitValue(h.uintTob32(1),150,0,'0x')
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    let dispFee = await governance.disputeFee()
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    await governance.beginDispute(h.uintTob32(1),_t);
    await governance.executeVote(1)
    await govTeam.vote(2,true,false);
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == web3.utils.toWei("50"), "stake amount should change properly")
    transAmt = web3.utils.toBN(await tellor.balanceOf(accounts[1].address)).sub(web3.utils.toBN(h.to18(50)))
    await tellorUser.transfer(accounts[4].address,transAmt.toString())
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await h.advanceTime(86400 * 8)
    await governance.tallyVotes(2);
    await h.advanceTime(86400 * 3)
    await governance.executeVote(2)
    assert(await tellor.balanceOf(accounts[1].address) == 0, "miner should be slashed")
    assert(await tellor.balanceOf(accounts[2].address)*1 - (initBalDisputer*1 +  1*web3.utils.toWei("50") - dispFee * .1) == 0, "disputer should get new stake amount")
  })

  it("Bad value placed, withdraw requested, dispute started", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    await oracle1.submitValue(h.uintTob32(1),150,0,'0x')
    await tellorUser.requestStakingWithdraw();
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 2 == 0, "status should be correct")
    transAmt = web3.utils.toBN(await tellor.balanceOf(accounts[1].address)).sub(web3.utils.toBN(h.to18(100)))
    await tellor.connect(accounts[1]).transfer(accounts[3].address, transAmt.toString())
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await governance.beginDispute(h.uintTob32(1),_t);
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 3 == 0, "status should be correct")
    await govTeam.vote(1,true,false);
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await h.advanceTime(86400 * 8)
    await h.expectThrow(tellorUser.withdrawStake());//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await governance.tallyVotes(1)
    await h.expectThrow(tellorUser.withdrawStake());//must have funds
    vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 4 == 0, "status should be correct")
    await h.advanceTime(86400 * 2)
    await governance.executeVote(1)
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 5 == 0, "status should be correct")
    await h.expectThrow(tellorUser.withdrawStake());//must have funds
    assert(await tellor.balanceOf(accounts[1].address) == 0, "miner should be slashed")
    await h.expectThrow(tellorUser.withdrawStake());//must have funds
  })
  it("Check increasing stake amount in the future", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    //vote to reduce the stakeAmount
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.proposeVote(tellorMaster,0x740358e6,ethers.utils.defaultAbiCoder.encode([ "bytes32","uint256" ],[h.hash("_STAKE_AMOUNT"),web3.utils.toWei("200")]),0)//changeUINT(hash(stakeAmount),50wei)
    await h.advanceTime(86400 * 8)
    await govTeam.vote(1,true,false);
    await govBig.vote(1,true,false);
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await governance.executeVote(1)
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == web3.utils.toWei("200"), "stake amount should change properly")
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),web3.utils.toWei("51"),'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,web3.utils.toWei("52")));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("50"));
    await h.expectThrow(tellorUser.transfer(accounts[4].address,web3.utils.toWei("50")));
    await h.expectThrow(oracle1.submitValue(h.uintTob32(1),150,0,'0x'))
    let vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 1 == 0, "status should be correct")
    await tellor.transfer(accounts[1].address,web3.utils.toWei("50"));
    await oracle1.submitValue(h.uintTob32(1),150,0,'0x')
    vars = await tellor.getStakerInfo(accounts[1].address)
    assert(vars[0] - 1 == 0, "status should be correct")
  })
  it("Check increasing stake amount in the future2", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
     await governance.proposeVote(tellorMaster,0x740358e6,ethers.utils.defaultAbiCoder.encode([ "bytes32","uint256" ],[h.hash("_STAKE_AMOUNT"),web3.utils.toWei("200")]),0)//changeUINT(hash(stakeAmount),50wei)
    await h.advanceTime(86400 * 8)
    await govTeam.vote(1,true,false);
    await govBig.vote(1,true,false);
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await oracle1.submitValue(h.uintTob32(1),150,0,'0x')
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    let dispFee = await governance.disputeFee()
    let initBalDisputer = await tellor.balanceOf(accounts[2].address)
    await governance.beginDispute(h.uintTob32(1),_t);
    transAmt = web3.utils.toBN(await tellor.balanceOf(accounts[1].address)).sub(web3.utils.toBN(h.to18(100)))
    await tellor.connect(accounts[1]).transfer(accounts[3].address, transAmt.toString())
    await governance.executeVote(1)
    await govTeam.vote(2,true,false);
    assert(await tellor.getUintVar(h.hash("_STAKE_AMOUNT")) == web3.utils.toWei("200"), "stake amount should change properly")
    await h.expectThrow(tellorUser.transfer(accounts[4].address,web3.utils.toWei("50")))
    await h.expectThrow(oracle1.tipQuery(h.uintTob32(1),2,'0x'));//must have funds
    await h.expectThrow(tellorUser.transfer(accounts[2].address,2));//must have funds
    await h.advanceTime(86400 * 8)
    await governance.tallyVotes(2);
    await h.advanceTime(86400 * 3)
    await governance.executeVote(2)
    assert(await tellor.balanceOf(accounts[1].address) == 0, "miner should be slashed")
    assert(await tellor.balanceOf(accounts[2].address)*1 - (initBalDisputer*1 +  1*web3.utils.toWei("100") - dispFee * .1) == 0, "disputer should get new stake amount")
  })
  it("Increase reporter lock time", async function() {
    tellorUser = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    oracle1 = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracle.address, accounts[1]);
    await tellor.transfer(accounts[1].address,web3.utils.toWei("100"));
    await tellorUser.depositStake();
    //vote to reduce the stakeAmount
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",governance.address, accounts[2]);
    await tellor.transfer(accounts[2].address,web3.utils.toWei("200"));
    await governance.proposeVote(oracle.address,0x5d183cfa,ethers.utils.defaultAbiCoder.encode(["uint256" ],[86400]),0)
    await h.advanceTime(86400 * 8)
    await govTeam.vote(1,true,false);
    await govBig.vote(1,true,false);
    await governance.tallyVotes(1)
    await h.advanceTime(86400 * 3)
    await governance.executeVote(1)
    await oracle1.submitValue(h.uintTob32(1),150,0,'0x')
    await h.advanceTime(86400/2  + 3600)//13 hours
    assert(await oracle.reportingLock() == 86400, "reporting lock should be correct")
    await h.expectThrow(oracle1.submitValue(h.uintTob32(1),150,1,'0x'));//must wait
    await h.advanceTime(60*60*11)//11 hours
    let _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),0);
    await h.expectThrow(governance.beginDispute(h.uintTob32(1),_t))
    await oracle1.submitValue(h.uintTob32(1),1750,1,'0x')
    await h.advanceTime(60*60*13)//13 hours
    _t = await oracle.getReportTimestampByIndex(h.uintTob32(1),1);
    await governance.beginDispute(h.uintTob32(1),_t)
  })

});
