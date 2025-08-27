module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('GreeterArbitrumL2', {
    from: deployer,
    log: true,
    args: ['Hello!'],
  });
};

module.exports.tags = ['greeter_arbitrum_l2'];
