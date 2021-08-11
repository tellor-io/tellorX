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
    let cfac,ofac,tfac,gfac,parachute
    let govSigner = null
  
  beforeEach("deploy and setup TellorX", async function() {
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber:13004700
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
    const devWallet = await ethers.provider.getSigner(DEV_WALLET);
    const bigWallet = await ethers.provider.getSigner(BIGWALLET);
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
    this.timeout(110000)
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
});
