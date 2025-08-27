module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('Greeter', {
    from: deployer,
    log: true,
    args: ['Hello!'],
  });
};

module.exports.tags = ['greeter'];
