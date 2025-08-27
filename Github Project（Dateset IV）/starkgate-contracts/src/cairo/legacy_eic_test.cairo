#[cfg(test)]
mod legacy_eic_test {
    use array::ArrayTrait;
    use array::SpanTrait;
    use starknet::contract_address::ContractAddressZeroable;
    use core::traits::Into;
    use core::result::ResultTrait;
    use traits::TryInto;
    use option::OptionTrait;
    use serde::Serde;
    use starknet::class_hash::{ClassHash, class_hash_const};
    use starknet::{ContractAddress, EthAddress, EthAddressZeroable, syscalls::deploy_syscall};
    use openzeppelin::token::erc20::presets::erc20_votes_lock::ERC20VotesLock::{
        DAPP_NAME, DAPP_VERSION
    };

    use src::legacy_bridge_eic::LegacyBridgeUpgradeEIC;
    use src::legacy_bridge_tester::LegacyBridgeTester;
    use src::replaceability_interface::{
        EICData, ImplementationData, IReplaceable, IReplaceableDispatcher,
        IReplaceableDispatcherTrait
    };
    use src::roles_init_eic::RolesExternalInitializer;
    use src::roles_interface::{IRolesDispatcher, IRolesDispatcherTrait};
    use src::test_utils::test_utils::{
        caller, get_roles, get_token_bridge, set_contract_address_as_caller, get_replaceable,
        simple_deploy_token, DEFAULT_UPGRADE_DELAY
    };
    use src::token_bridge_interface::{ITokenBridgeDispatcher, ITokenBridgeDispatcherTrait};
    use src::token_bridge::TokenBridge;
    use src::update_712_vars_eic::Update712VarsEIC;
    use src::update712_eic_tester::{
        Update712EICTester, ITester, ITesterDispatcher, ITesterDispatcherTrait
    };

    fn L1_TOKEN_ADDRESS() -> EthAddress {
        EthAddress { address: 2023 }
    }

    fn L2_TOKEN_ADDRESS() -> ContractAddress {
        starknet::contract_address_const::<1973>()
    }

    fn BAD_L2_TOKEN_ADDRESS() -> ContractAddress {
        starknet::contract_address_const::<2073>()
    }

    fn get_712_tester(contract_address: ContractAddress) -> ITesterDispatcher {
        ITesterDispatcher { contract_address }
    }

    fn deploy_legacy_tester(l2_token: ContractAddress) -> ContractAddress {
        let mut calldata = ArrayTrait::new();
        l2_token.serialize(ref calldata);

        // Set the caller address for all the functions calls (except the constructor).
        set_contract_address_as_caller();

        // Deploy the contract.
        let (tester, _) = deploy_syscall(
            legacy_bridge_tester_impl_hash(), 0, calldata.span(), false
        )
            .unwrap();
        tester
    }

    fn deploy_eip_712_tester() -> ContractAddress {
        let mut calldata = array![];
        // Set the caller address for all the functions calls (except the constructor).
        set_contract_address_as_caller();

        // Deploy the contract.
        let (tester, _) = deploy_syscall(update_712_eic_tester_hash(), 0, calldata.span(), false)
            .unwrap();
        tester
    }

    #[test]
    #[available_gas(30000000)]
    fn test_deploy_tester() {
        let tester_address = deploy_legacy_tester(L2_TOKEN_ADDRESS());
        assert(tester_address.is_non_zero(), 'Failed deploying tester');
    }

    fn token_bridge_impl_hash() -> ClassHash {
        TokenBridge::TEST_CLASS_HASH.try_into().unwrap()
    }

    fn legacy_bridge_tester_impl_hash() -> ClassHash {
        LegacyBridgeTester::TEST_CLASS_HASH.try_into().unwrap()
    }

    fn update_712_eic_tester_hash() -> ClassHash {
        Update712EICTester::TEST_CLASS_HASH.try_into().unwrap()
    }

    fn update_712_eic_hash() -> ClassHash {
        Update712VarsEIC::TEST_CLASS_HASH.try_into().unwrap()
    }

    fn roles_init_eic_hash() -> ClassHash {
        RolesExternalInitializer::TEST_CLASS_HASH.try_into().unwrap()
    }

    fn custom_712_eic_implementation_data(impl_hash: ClassHash) -> ImplementationData {
        generic_eic_implementation_data(:impl_hash, eic_hash: update_712_eic_hash())
    }

    fn custom_roles_eic_implementation_data(impl_hash: ClassHash) -> ImplementationData {
        generic_eic_implementation_data(:impl_hash, eic_hash: roles_init_eic_hash())
    }

    fn generic_eic_implementation_data(
        impl_hash: ClassHash, eic_hash: ClassHash
    ) -> ImplementationData {
        let mut calldata = array![];
        let eic_data = EICData { eic_hash, eic_init_data: calldata.span() };

        ImplementationData { impl_hash, eic_data: Option::Some(eic_data), final: false }
    }

    fn token_bridge_w_eic_implementation_data(
        l1_token: EthAddress, l2_token: ContractAddress
    ) -> ImplementationData {
        let mut calldata = ArrayTrait::new();
        l1_token.serialize(ref calldata);
        l2_token.serialize(ref calldata);

        let eic_data = EICData {
            eic_hash: LegacyBridgeUpgradeEIC::TEST_CLASS_HASH.try_into().unwrap(),
            eic_init_data: calldata.span()
        };

        ImplementationData {
            impl_hash: token_bridge_impl_hash(), eic_data: Option::Some(eic_data), final: false
        }
    }

    fn token_long_eic_data_implementation_data(
        l1_token: EthAddress, l2_token: ContractAddress
    ) -> ImplementationData {
        let mut calldata = ArrayTrait::new();
        l1_token.serialize(ref calldata);
        l2_token.serialize(ref calldata);
        l2_token.serialize(ref calldata);

        let eic_data = EICData {
            eic_hash: LegacyBridgeUpgradeEIC::TEST_CLASS_HASH.try_into().unwrap(),
            eic_init_data: calldata.span()
        };

        ImplementationData {
            impl_hash: token_bridge_impl_hash(), eic_data: Option::Some(eic_data), final: false
        }
    }

    fn bridge_no_eic_impl_data() -> ImplementationData {
        ImplementationData {
            impl_hash: token_bridge_impl_hash(), eic_data: Option::None(()), final: false
        }
    }

    fn tester_legacy_bridge_no_eic_implementation_data() -> ImplementationData {
        ImplementationData {
            impl_hash: legacy_bridge_tester_impl_hash(), eic_data: Option::None(()), final: false
        }
    }

    fn add_impl_and_replace_to(
        replaceable_address: ContractAddress, implementation_data: ImplementationData
    ) {
        let replaceable = get_replaceable(:replaceable_address);
        starknet::testing::set_block_timestamp(DEFAULT_UPGRADE_DELAY + 1);

        // Add implementation and advance time to enable it.
        replaceable.add_new_implementation(:implementation_data);

        replaceable.replace_to(:implementation_data);
    }

    #[test]
    #[available_gas(30000000)]
    fn test_happy_path() {
        let l2_token = simple_deploy_token();
        let tester_address = deploy_legacy_tester(:l2_token);
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), :l2_token,
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );

        let token_bridge = get_token_bridge(tester_address);
        let l1_token = token_bridge.get_l1_token(:l2_token);
        let l2_token_actual = token_bridge.get_l2_token(L1_TOKEN_ADDRESS());
        assert(L1_TOKEN_ADDRESS() == l1_token, 'L1_ZEROED');
        assert(l2_token == l2_token_actual, 'L2_ZEROED');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_roles_init_eic() {
        // Tester 1 is upgraded to the token_bridge w/o the EIC.
        let tester1 = deploy_legacy_tester(ContractAddressZeroable::zero());
        let implementation_data = bridge_no_eic_impl_data();
        add_impl_and_replace_to(replaceable_address: tester1, :implementation_data);

        // Tester 1 roles are not initialzied, and gov admin not set.
        let roles1 = get_roles(contract_address: tester1);
        assert(!roles1.is_governance_admin(caller()), 'Roles should not be initialized');
        assert(!roles1.is_upgrade_governor(caller()), 'Roles should not be initialized');
        assert(!roles1.is_security_admin(caller()), 'Roles should not be initialized');

        // Tester 2 is upgraded to the token_bridge with the roles EIC.
        let tester2 = deploy_legacy_tester(ContractAddressZeroable::zero());
        let implementation_data = custom_roles_eic_implementation_data(token_bridge_impl_hash());
        add_impl_and_replace_to(replaceable_address: tester2, :implementation_data);

        // Tester 2 roles are initialized and gov admin assigned.
        let roles = get_roles(contract_address: tester2);
        assert(roles.is_governance_admin(caller()), 'Roles should be initialized');
        assert(roles.is_upgrade_governor(caller()), 'Roles should be initialized');
        assert(roles.is_security_admin(caller()), 'Roles should be initialized');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_update_eip712_vars_eic() {
        // Test update_eip712_eic - i.e. that the eic populate vars correctly.

        // Deploy tester & check that vars are empty.
        let tester_address = deploy_eip_712_tester();
        let tester = get_712_tester(tester_address);
        assert(tester.get_dapp_name() == '', 'dapp_name not empty');
        assert(tester.get_dapp_version() == '', 'dapp_version not empty');

        // Perform an update with the update_712_eic.
        let implementation_data = custom_712_eic_implementation_data(update_712_eic_tester_hash());
        add_impl_and_replace_to(replaceable_address: tester_address, :implementation_data);

        // Check that variables are now with correct values.
        assert(tester.get_dapp_name() == DAPP_NAME, 'Bad dapp_name');
        assert(tester.get_dapp_version() == DAPP_VERSION, 'Bad dapp_version');

        // Sanity - assert that the values are what we really expect.
        assert(DAPP_NAME == 'TOKEN_DELEGATION', 'Broken test');
        assert(DAPP_VERSION == '1.0.0', 'Broken test');
    }

    #[test]
    #[should_panic(expected: ('EIC_INIT_DATA_LEN_MISMATCH_2', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_bad_eic_data() {
        // Fail on bad eic data size.
        let tester_address = deploy_legacy_tester(L2_TOKEN_ADDRESS());
        let impl_data = token_long_eic_data_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), l2_token: L2_TOKEN_ADDRESS(),
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }

    #[test]
    #[should_panic(expected: ('NOT_LEGACY_BRIDGE', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_not_legacy() {
        // Fail on a non-legacy bridge.
        let tester_address = deploy_legacy_tester(ContractAddressZeroable::zero());
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), l2_token: L2_TOKEN_ADDRESS(),
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }

    #[test]
    #[should_panic(expected: ('ZERO_L2_TOKEN', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_zero_l2_token_address() {
        // Test failing to upgrade with a zero l2 token address sent to the upgrade.
        let tester_address = deploy_legacy_tester(L2_TOKEN_ADDRESS());
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), l2_token: ContractAddressZeroable::zero(),
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }

    #[test]
    #[should_panic(expected: ('TOKEN_ADDRESS_MISMATCH', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_mismatch_l2_token_address() {
        // Test failing to upgrade with an inconsistent l2 token address sent to the upgrade.
        let tester_address = deploy_legacy_tester(L2_TOKEN_ADDRESS());
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), l2_token: BAD_L2_TOKEN_ADDRESS(),
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }

    #[test]
    #[should_panic(expected: ('ZERO_L1_TOKEN', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_zero_l1_token_address() {
        // Test failing to upgrade with  a zero l1 token address sent to the upgrade.
        let tester_address = deploy_legacy_tester(L2_TOKEN_ADDRESS());
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: EthAddressZeroable::zero(), l2_token: L2_TOKEN_ADDRESS(),
        );
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }

    #[test]
    #[should_panic(expected: ('L2_BRIDGE_ALREADY_INITIALIZED', 'ENTRYPOINT_FAILED',))]
    #[available_gas(30000000)]
    fn test_upgrade_an_upgraded() {
        // Test failing to upgrade twice.
        let l2_token = simple_deploy_token();
        let tester_address = deploy_legacy_tester(l2_token);
        let impl_data = token_bridge_w_eic_implementation_data(
            l1_token: L1_TOKEN_ADDRESS(), :l2_token,
        );

        // Upgrade first time. All goes well.
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );

        // Replace back to the tester class hash. state already post upgrade.
        add_impl_and_replace_to(
            replaceable_address: tester_address,
            implementation_data: tester_legacy_bridge_no_eic_implementation_data(),
        );

        // Upgrade second time. Fail.
        add_impl_and_replace_to(
            replaceable_address: tester_address, implementation_data: impl_data,
        );
    }
}
