const { AbiCoder } = require("@ethersproject/abi");
const { expect } = require("chai");
const h = require("./helpers/helpers");
var assert = require('assert');
const web3 = require('web3');

describe("TellorX Function Tests - Token", function () {

    const tellorMaster = "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
    const DEV_WALLET = "0x39E419bA25196794B595B2a595Ea8E527ddC9856"
    let accounts = null
    let tellor = null
    let cfac,ofac,tfac,gfac,devWallet
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
        cfac = await ethers.getContractFactory("contracts/Controller.sol:TestController");
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

      it("approve and allowance", async function() {
          //create user account, mint it tokens
          
          //approve dev wallet to spend for the user

          //check balances
      })

      it("allowed to trade", async function() {
          //create user account, mint it tokens

          //stake the user

          //cant transfer more than total balance - stake
      })
})