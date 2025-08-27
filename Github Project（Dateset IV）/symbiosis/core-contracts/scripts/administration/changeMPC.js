const {ethers} = require("hardhat");
const {timeout} = require("../utils/timeout");

async function main() {
    const [owner] = await ethers.getSigners();
    console.log("Setup contracts with the account:", owner.address);
    console.log("Account balance:", (await owner.getBalance()).toString());

    const network = hre.network.name;
    const currentDeployment = require(`../deployments/deployWithBridgeV2-${network}.json`);

    const Bridge = await ethers.getContractFactory("BridgeV2");
    const bridge = await Bridge.attach(currentDeployment["bridge"].proxy);
    console.log('BridgeV2 attached to', bridge.address);

    const newMPC = "0x7AC17F4F37b568E33ecdBB458f38f13C5F717332"; // TODO: check address before run

    await bridge.changeMPC(newMPC);
    await timeout(15000);
    console.log("MPC changed to", await bridge.mpc());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
