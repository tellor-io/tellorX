//require("@nomiclabs/hardhat-truffle5");
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("solidity-coverage");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

//const dotenv = require('dotenv').config()
//npx hardhat run scripts/deploy.js --network rinkeby

async function deployTellorx(_pk, _nodeURL) {
    console.log(">>>>> Starting to deploy tellor 3")
    await run("compile")


    ///////////////Connect to the network
    let privateKey = _pk;
    var provider = new ethers.providers.JsonRpcProvider(_nodeURL)
    let wallet = new ethers.Wallet(privateKey, provider)


    ////////////// Deploy Tellor 3

    //////////////// Extension
    console.log("Starting deployment for extension contract...")
    const extfac = await ethers.getContractFactory("contracts/tellor3/Extension.sol:Extension", wallet)
    const extension = await extfac.deploy()
    await extension.deployed()
    console.log("Extension contract deployed to: ", extension.address)





    //////////////// Tellor (Test)
    console.log("Starting deployment for tellor contract...")
    const telfac = await ethers.getContractFactory("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", wallet)
    const tellor = await telfac.deploy(extension.address)
    await tellor.deployed()
    console.log("Tellor contract deployed to: ", tellor.address)



    //////////////// Master
    console.log("Starting deployment for master contract...")
    const masfac = await ethers.getContractFactory("contracts/tellor3/TellorMaster.sol:TellorMaster", wallet)
    const master = await masfac.deploy(tellor.address, tellor.address) // use same addr for _OLD_TELLOR and _newTellor?
    await master.deployed()
    console.log("Master contract deployed to: ", master.address)



    /////////// Deploy Tellor X
    console.log(">>>>> Starting to deploy tellor X")

    ////////////////Governance
    console.log("Starting deployment for governance contract...")
    const gfac = await ethers.getContractFactory("contracts/Governance.sol:Governance", wallet)
    const governance = await gfac.deploy(master.address)
    await governance.deployed()
    console.log("Governance contract deployed to: ", governance.address)

    /////////////Oracle
    console.log("Starting deployment for Oracle contract...")
    const ofac = await ethers.getContractFactory("contracts/Oracle.sol:Oracle", wallet)
    const oracle = await ofac.deploy(master.address)
    await oracle.deployed();
    console.log("Oracle contract deployed to: ", oracle.address)

    ///////////Treasury
    console.log("Starting deployment for Treasury contract...")
    const tfac = await ethers.getContractFactory("contracts/Treasury.sol:Treasury", wallet)
    const treasury = await tfac.deploy(master.address)
    await treasury.deployed()
    console.log("Treasury contract deployed to: ", treasury.address)

    //////////////Controler
    console.log("Starting deployment for Controller contract...")
    const cfac = await ethers.getContractFactory("contracts/Controller.sol:Controller", wallet)
    const controller = await cfac.deploy(governance.address, oracle.address, treasury.address)
    await controller.deployed()
    console.log("Controller contract deployed to: ", controller.address)

    tellorTest = await ethers.getContractAt("contracts/tellor3/Mocks/TellorTest.sol:TellorTest", master.address)
    await tellorTest.connect(wallet).setBalanceTest(wallet.address, ethers.BigNumber.from("1000000000000000000000000"))
    await master.connect(wallet).changeTellorContract(controller.address)
    tellorNew = await ethers.getContractAt("contracts/Controller.sol:Controller", master.address)
    await tellorNew.connect(wallet).init()

    console.log("TellorX deployed! You have 1 million test TRB in your wallet.")


    // Use try and catch to ignore throw all verify errors as sometime etherscan verifies contracts automatically when an identical contract exists.
    // Use `deployTransaction.wait` to wait for few confirmed transactions as otherwise the etherscan api doesn't find the deployed contract.

    try {
        console.log('Submitting extension contract for verification...');
        await extension.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: extension.address,
            },
        )
        console.log("Extension contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }

    try {
        console.log('Submitting controller contract for verification...');
        await controller.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: controller.address,
                constructorArguments: [governance.address, oracle.address, treasury.address]
            },
        )
        console.log("Controller contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }

    try {
        console.log('Submitting tellor contract for verification...');
        await tellor.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: tellor.address,
                constructorArguments: [extension.address]
            },
        )
        console.log("Tellor contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }

    try {
        console.log('Submitting master contract for verification...');
        await master.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: master.address,
                constructorArguments: [tellor.address, tellor.address]
            },
        )
        console.log("Master contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }

    try {
        console.log('Submitting governance contract for verification...');
        await governance.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: governance.address,
                constructorArguments: [master.address]
            },
        )
        console.log("Governance contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }
    try {
        console.log('Submitting Treasury contract for verification...');
        await treasury.deployTransaction.wait(7)
        await run("verify:verify",
            {
                address: treasury.address,
                constructorArguments: [master.address]
            },
        )
        console.log("Treasury contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }

    try {
        console.log('Submitting Oracle contract for verification...');
        await oracle.deployTransaction.wait(7)

        await run("verify:verify",
            {
                address: oracle.address,
                constructorArguments: [master.address]
            },
        )
        console.log("Oracle contract verified")
    } catch (error) {
        console.log('error verifying contract:', error)
    }
}


deployTellorx(process.env.TESTNET_PK, process.env.NODE_URL_RINKEBY)
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
