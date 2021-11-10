const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("../../test/helpers/helpers");
var assert = require('assert');
const web3 = require('web3');
const fetch = require('node-fetch')

// Hardhat forking tests for after TellorX is deployed, before init called

describe("TellorX Function Tests - Token", function() {

  const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  const controllerAddress = "0x45b778325ECf22E317767028a50749ff1D41E30b"
  const oracleAddress = "0xD7b3529A008d1791Ea683b6Ac909ecE309603C12"
  const governanceAddress = "0x8Db04961e0f87dE557aCB92f97d90e2A2840A468"
  const treasuryAddress = "0x2fcAb47708fcE3713fD4420A0dDD5270b5b92632"
  const DEV_WALLET = "0x2F51C4Bf6B66634187214A695be6CDd344d4e9d1"
  const PARACHUTE = "0x83eB2094072f6eD9F57d3F19f54820ee0BaE6084"
  const BIGWALLET = "0x41C5a04F61b865e084E5F502ff322aD624CaD609";
  const FORK_DISPUTE_ID = 10;
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
            // jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            jsonRpcUrl: "https://eth-rinkeby.alchemyapi.io/v2/I-BlqR7R6s5-Skel3lnCwJzamDbmXHLF",
            blockNumber:9607000
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
    governance = await ethers.getContractAt("contracts/Governance.sol:Governance", governanceAddress)
    oracle = await ethers.getContractAt("contracts/Oracle.sol:Oracle", oracleAddress)
    treasury = await ethers.getContractAt("contracts/Treasury.sol:Treasury", treasuryAddress)
    controller = await ethers.getContractAt("contracts/Controller.sol:Controller", controllerAddress)
    gfac = await ethers.getContractFactory("contracts/testing/TestGovernance.sol:TestGovernance");
    ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle");
    tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury");
    cfac = await ethers.getContractFactory("contracts/testing/TestController.sol:TestController");
    sendfac = await ethers.getContractFactory("contracts/testing/ForceSendEther.sol:ForceSendEther");
    forceSend = await sendfac.deploy();
    await forceSend.deployed();
    await accounts[0].sendTransaction({to:DEV_WALLET,value:ethers.utils.parseEther("1.0")});
    devWallet = await ethers.provider.getSigner(DEV_WALLET);
    bigWallet = await ethers.provider.getSigner(BIGWALLET);
    master = await oldTellorInstance.connect(devWallet)
    // await master.proposeFork(controller.address);
    // let _id = await master.getUintVar(h.hash("_DISPUTE_COUNT"))
    let _id = FORK_DISPUTE_ID
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
    await accounts[1].sendTransaction({to:forceSend.address,value:ethers.utils.parseEther("1.0")});
    await forceSend.forceSendEther(governance.address);
    govSigner = await ethers.provider.getSigner(governance.address);
    // await tellor.connect(accounts[1]).transfer(accounts[10].address, await tellor.balanceOf(accounts[1].address))
    });

	  it("approve() and allowance()", async function() {
      this.timeout(20000000)
		  //create user account, mint it tokens
		  let acc = await ethers.getSigner()
		  await tellor.connect(devWallet).transfer(acc.address, BigInt(5E20))

		  //approve dev wallet to spend for the user
		  await tellor.connect(acc).approve(DEV_WALLET, BigInt(2E20))

		  //check allowances
		  let allowance = BigInt(await tellor.allowance(acc.address, DEV_WALLET))
		  expect(allowance).to.equal(BigInt(2E20))
	  });

    it("approveAndTransferFrom()", async function() {
      await tellor.connect(devWallet).transfer(accounts[1].address, web3.utils.toWei("50"))
      await h.expectThrow(tellor.connect(accounts[3]).approveAndTransferFrom(accounts[1].address, accounts[3].address, web3.utils.toWei("20")))
      await tellor.connect(govSigner).approveAndTransferFrom(accounts[1].address, accounts[3].address, web3.utils.toWei("20"))
      blocky = await ethers.provider.getBlock();
      assert(await tellor.balanceOf(accounts[1].address) == web3.utils.toWei("30"))
      assert(await tellor.balanceOf(accounts[3].address) == web3.utils.toWei("20"))
      assert(await tellor.balanceOfAt(accounts[3].address,blocky.number) == web3.utils.toWei("20"))
    })

	  it("allowedToTrade()", async function() {
		  let mintedTokens = BigInt(101E18)
		  let stake = BigInt(100E18)
		  //create user account, mint it tokens
		  let acc = accounts[1]
		  await tellor.connect(devWallet).transfer(acc.address, mintedTokens)

		  //if not staked, returns true if balance >= amount
		  let allowedToTrade = await tellor.allowedToTrade(acc.address, BigInt(40E18))
		  expect(allowedToTrade).to.be.true

		  //stake the user
		  await tellor.connect(acc).depositStake()

		  //returns false if amount > (total balance - stake)
		  allowedToTrade = await tellor.allowedToTrade(acc.address, BigInt(2E18))
		  expect(allowedToTrade).to.be.false

		  //returns true if amount <= (total balance - stake)
		  allowedToTrade = await tellor.allowedToTrade(acc.address, BigInt(1E18))
		  expect(allowedToTrade).to.be.true
	  })

	  it("balanceOf()", async function() {
		  let mintedTokens = BigInt(2E18)

		  //create user, mint it tokens
		  let acc = accounts[1]
		  await tellor.connect(devWallet).transfer(acc.address, mintedTokens)

		  //check balance is same as minted amount
		  let balance = await tellor.balanceOf(acc.address)
		  expect(balance).to.equal(mintedTokens)
	  })

	  it("balanceOfAt()", async function() {
		  //an account with a balance
      expect(await tellor.balanceOfAt(accounts[2].address, 9607000)).to.equal("4388387505649336451822")
	  })

	  it("burn", async function() {
		  //an account with a balance
		  let mintedTokens = BigInt(2E18)
		  let burnedTokens = BigInt(1E18)
		  let acc = accounts[1]
		  await tellor.connect(devWallet).transfer(acc.address, mintedTokens)

		  //burn some of the balance
		  await tellor.connect(acc).burn(burnedTokens)

		  //expect balance has decreased by amount burned
		  balance = await tellor.balanceOf(acc.address)
		  expect(balance).to.equal(mintedTokens - burnedTokens)

	  })

	  it("transfer", async function() {
		  //two accounts
      let acc1 = accounts[1]
      let acc2 = accounts[3]
		  await tellor.connect(devWallet).transfer(acc1.address, BigInt(5E18))

		  //transfer an amount to second account
		  await tellor.connect(acc1).transfer(acc2.address, BigInt(3E18))

		  //expect second account's balance to be transferred amount
		  let balance = await tellor.balanceOf(acc2.address)
		  expect(balance).to.equal(BigInt(3E18))

		  //expect first account's balance to be original balance - transferred amount
		  balance = await tellor.balanceOf(acc1.address)
		  expect(balance).to.equal(BigInt(2E18))

	  })

	  it("transfer from", async function() {
		  //mint an account tokens
      let acc1 = accounts[1]
      let acc2 = accounts[3]
		  let mintedTokens = BigInt(502E18)
		  await tellor.connect(devWallet).transfer(acc1.address, mintedTokens)
		  //expect sender can't transfer funds for another use without permission
		  await expect(tellor.connect(acc1).transferFrom(acc2.address, acc1.address, 1)).to.be.reverted
		  //stake account
		  await tellor.connect(acc1).depositStake()
		  //expect successful transfer decreases _from balance by _amount
		  await tellor.connect(acc1).approve(acc2.address, BigInt(4E18))
		  let balance = await tellor.balanceOf(acc1.address)
		  expect(balance).to.equal(mintedTokens)
		  await tellor.connect(acc2).transferFrom(acc1.address, acc2.address,BigInt(4E18))
		  //expect successful transfer increases _to balance by _amount
		  balance = await tellor.balanceOf(acc2.address)
		  expect(balance).to.equal(BigInt(4E18))

	  })
})
