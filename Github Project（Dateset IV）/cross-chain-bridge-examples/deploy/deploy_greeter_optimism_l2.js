module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // only deploy to Optimism testnet
  if (network.name == 'optimism') {
    // this is the Optimism L2StandardBridge address
    let bridge = '0x4200000000000000000000000000000000000010';

    await deploy('GreeterOptimismL2', {
      from: deployer,
      log: true,
      args: [bridge, 'Hello!'],
    });
  }
};

module.exports.tags = ['greeter_optimism_l2'];
