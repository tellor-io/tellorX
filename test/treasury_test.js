const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const { ethers } = require("hardhat");
const { stakeAmount } = require("./helpers/helpers");
const { keccak256 } = require("ethers/lib/utils");

describe("End-to-End Tests - Treasury", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0xF977814e90dA44bFA03b6295A0616a897441aceC"
  const govAdd = "0x51d4088d4EeE00Ae4c55f46E0673e9997121DB00"
  const treasAdd = "0x3b0f3eaEFaAc9f8F7FDe406919ecEb5270fE0607"
  const oracleAdd = "0xe8218cACb0a5421BC6409e498d9f8CC8869945ea"
  const controllerAdd = "0xf98624E9924CAA2cbD21cC6288215Ec2ef7cFE80"
  let accounts = null
  let tellor = null
  let cfac,ofac,tfac,gfac,parachute,govBig,govTeam,transition,startSupply,treasury, governance, oracle, controller
  let govSigner = null
  

  beforeEach("deploy and setup TellorX", async function() {
    this.timeout(20000000)
    accounts = await ethers.getSigners();
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [{forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: 13998326
            //13998326 13147399

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


    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    tellor = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, devWallet);
    parachute = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",PARACHUTE, devWallet);
    govTeam = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",govAdd, devWallet);
    govBig = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",govAdd, bigWallet);
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasAdd,accounts[1]);
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",govAdd,accounts[1]);
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller",controllerAdd,accounts[1]);
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle",oracleAdd,accounts[1]);
     await governance.deployed();
     await oracle.deployed();
     await treasury.deployed();
     await controller.deployed();

    await tellor.deployed();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [govAdd]}
    )

    govSigner = await ethers.provider.getSigner(govAdd);
    transition = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, accounts[1]);
    startSupply= ethers.BigNumber.from(await transition.totalSupply())
    

    });


  it("Test a valid vote on Treasury and check supply", async function() {
    this.timeout(20000000)
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",govAdd, accounts[1]);
    await tellor.connect(bigWallet).transfer(accounts[1].address,await tellor.balanceOf(BIGWALLET));
    
    let voteCount;

    // ****************************************
    // * issueTreasury(uint256,uint256,uint256)
    // ****************************************
    let vars = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256'], [web3.utils.toWei("100000"),.025*10000,86400*90])

    await governance.proposeVote(treasAdd, 0x6274885f,vars, 0);

    //voteCount = await governance.getVoteCount();
    voteCount = 3;
    await governance.vote(voteCount, true, false);
    await h.advanceTime(604800);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400);
    await governance.executeVote(voteCount);
    let treasuryDetails = await treasury.getTreasuryDetails(1);
    assert(treasuryDetails[1] == web3.utils.toWei("100000"), "Treasury amount should be correct");
    assert(treasuryDetails[2] == 250, "Treasury rate should be correct");
    let endSupply= ethers.BigNumber.from(await transition.totalSupply())
    endSupply = endSupply/1e18
    startSupply = startSupply/1e18
    assert(endSupply == startSupply, "supply changed before payout")
  });

  it("Treasury buyer does the treasury reward math check out?", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",govAdd, devWallet);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    treasGov = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasAdd, govSigner);
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasAdd, accounts[1]);
    //BIGWALLET start balance
    let startBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    let voteCount;
    let treasDuration = 86400*90;
    let treasRate = 250;
    let treasAmount = web3.utils.toWei("100000");

    //await treasGov.issueTreasury(web3.utils.toWei("100000"),treasRate,treasDuration);
    let vars = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256'], [web3.utils.toWei("100000"),.025*10000,86400*90])
   
    await governance.proposeVote(treasAdd, 0x6274885f,vars, 0);
    voteCount = await governance.getVoteCount();
    await governance.connect(devWallet).vote(voteCount, true, false);
    await governance.connect(bigWallet).vote(voteCount, true, false);
    await h.advanceTime(86400*8);
    await governance.tallyVotes(voteCount);
    await h.advanceTime(86400*2.5)
    await governance.connect(bigWallet).executeVote(voteCount);

    treasCount = await treasury.getTreasuryCount()
    treasDetail = await treasury.getTreasuryDetails(treasCount)
    await treasury.connect(bigWallet).buyTreasury(treasCount,web3.utils.toWei("100000"));
 
    //BIGWALLET balance after buying treasury
    let treasBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    treasAmount = ethers.BigNumber.from(treasAmount);
    //Max Rate of return on total treasury issued
    let ror = treasAmount.mul(treasRate).div(10000)
    ror = ror/1e18
    
    //calculate expected balance for BIGWALLET that bought entire treasury
    let treasbal = ethers.BigNumber.from( await treasury.getTreasuryFundsByUser(BIGWALLET))
    let expectedBal = treasAmount.mul(treasRate).div(10000).add(treasBigWalletBal).add(treasbal);
    treasBigWalletBal = treasBigWalletBal/1e18

    //Pay treasury
    await h.advanceTime(treasDuration);
    await treasury.payTreasury(BIGWALLET,1);
    //Get big wallet actual balance after payout
    let realBal = await tellor.balanceOf(BIGWALLET);
    realBal = realBal/1e18

    let endBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    let diffBwallet = endBigWalletBal.sub(startBigWalletBal)
    diffBwallet = diffBwallet/1e18
    assert(diffBwallet== ror, "BigWallet balance difference should equal the rate of return")

    let endSupply= ethers.BigNumber.from(await transition.totalSupply())
    endSupply = endSupply/1e18
    startSupply = startSupply/1e18
    let diffInSupply = endSupply-startSupply
    assert (diffInSupply== ror, "supply difference ceteris paribus should be the rate of return")
    
    expectedBal= expectedBal/1e18
    assert(realBal==expectedBal, "User balance should be correct");

  });

  it("Treasury buyer votes on 2/3 of proposals, does the treasury reward math check out?", async function() {
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance",govAdd, devWallet);
    admin = await ethers.getContractAt("contracts/interfaces/ITellor.sol:ITellor",tellorMaster, govSigner);
    treasGov = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasAdd, govSigner);
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury",treasAdd, accounts[1]);
    //BIGWALLET start balance
    let startBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    let voteCount;
    let treasDuration = 86400*90;
    let treasRate = 250;
    let treasAmount = web3.utils.toWei("100000");

    //await treasGov.issueTreasury(web3.utils.toWei("100000"),treasRate,treasDuration);
    let vars = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'uint256'], [web3.utils.toWei("100000"),.025*10000,86400*90])
    await governance.proposeVote(treasAdd, 0x6274885f,vars, 0);
    let voteCount1 = await governance.getVoteCount();
    await governance.connect(devWallet).vote(voteCount1, true, false);
    await governance.connect(bigWallet).vote(voteCount1, true, false);
    await h.advanceTime(86400*8);
    await governance.tallyVotes(voteCount1);
    await h.advanceTime(86400*2.5)
    await governance.connect(bigWallet).executeVote(voteCount1);
    treasCount = await treasury.getTreasuryCount()
    treasDetail = await treasury.getTreasuryDetails(treasCount)
    await treasury.connect(bigWallet).buyTreasury(treasCount,web3.utils.toWei("100000"));

    
    //BIGWALLET balance after buying treasury
    let treasBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    treasAmount = ethers.BigNumber.from(treasAmount);
    //Max Rate of return on total treasury issued

    let ror = treasAmount.mul(treasRate).div(10000).mul(2).div(3)
   
    //calculate expected balance for BIGWALLET that bought entire treasury
    let treasbal = ethers.BigNumber.from( await treasury.getTreasuryFundsByUser(BIGWALLET))
    let expectedBal = ror.add(treasBigWalletBal).add(treasbal);
    treasBigWalletBal = treasBigWalletBal/1e18
    ror = ror/1e18

     //Three proposals but only vote on two of them
     gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
     let newGovernance = await gfac.deploy();

     // Proposal 1
     await newGovernance.deployed();
     proposalData = ethers.utils.hexZeroPad(newGovernance.address, 32);
     await governance.connect(devWallet).proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
      voteCount = await governance.voteCount();
     await governance.connect(bigWallet).vote(voteCount, true, false);
     // Proposal 2
     await governance.connect(devWallet).proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
     voteCount = await governance.voteCount();
     await governance.connect(bigWallet).vote(voteCount, true, false);
     // Proposal 3
     await governance.connect(devWallet).proposeVote(tellorMaster, 0xe8ce51d7, proposalData, 0);
     

    //Pay treasury
    await h.advanceTime(treasDuration);
    await treasury.payTreasury(BIGWALLET,1);
    //Get big wallet actual balance after payout
    let realBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    let endBigWalletBal = ethers.BigNumber.from(await tellor.balanceOf(BIGWALLET));
    let diffBwallet = endBigWalletBal.sub(startBigWalletBal)
    diffBwallet = diffBwallet/1e18

    assert(diffBwallet== ror, "BigWallet balance difference should equal the rate of return")

    let endSupply= ethers.BigNumber.from(await transition.totalSupply())
    let diffInSupply = endSupply.sub(startSupply)
    diffInSupply= diffInSupply/1e18
    assert (diffInSupply== ror, "supply difference ceteris paribus should be the rate of return")

    voteCount2 = await governance.getVoteCount();
    assert(voteCount2- voteCount1==3, "vote count ")

    diffRound= expectedBal.sub(realBal)
    assert(diffRound ==0, "User balance should be correct");

  });


});