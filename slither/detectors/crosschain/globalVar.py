import networkx as nx
# def _init():
#     global CROSSCHAINSENDSIGLIST
#
#     global CROSSCHAINRECEIVESIGLIST
#
#     global CROSSCHAINSENDEVENTLIST
#     ST
#     global CROSSCHAINRECEIVEEVENTLI

XGRAPH = nx.Graph()
    # For Polygon
# GCROSSCHAINSENDSIGLIST = ["lockTokens(address,address,address,bytes)"]
# GCROSSCHAINRECEIVESIGLIST = ["exitTokens(address,address,bytes)", "receive2(address,address,uint256)"]
# GCROSSCHAINSENDEVENTLIST = ["LockedEther", "eventsend2"]
# GCROSSCHAINRECEIVEEVENTLIST = ["ExitedEther", "eventreceive2"]



    # For cBridgev2
# GCROSSCHAINSENDSIGLIST = ["send(address,address,uint256,uint64,uint64,uint32)", "sendNative(address,uint256,uint64,uint64,uint32)"]
# GCROSSCHAINRECEIVESIGLIST = ["relay(bytes,bytes[],address[],uint256[])"]
# GCROSSCHAINSENDEVENTLIST = ["Send"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Relay"]


 # For Harmony
# GCROSSCHAINSENDSIGLIST = ["lockTokens(address,uint256,address)", "lockTokenFor(address,address,uint256,address)"]
# GCROSSCHAINRECEIVESIGLIST = ["unlockToken(address,uint256,address,bytes32)"]
# GCROSSCHAINSENDEVENTLIST = ["Locked"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Unlocked"]


# For Samobridgeeth
GCROSSCHAINSENDSIGLIST = [
    "deposit(uint256,uint256)"
]

GCROSSCHAINRECEIVESIGLIST = [
    "withdraw(address,uint256)"
]

GCROSSCHAINSENDEVENTLIST = [
    "Deposit"
]

GCROSSCHAINRECEIVEEVENTLIST = [
    "Withdraw"
]

# # For CCPool
# GCROSSCHAINSENDSIGLIST = [
#     "crossTo(uint256,uint256)"
# ];
#
# GCROSSCHAINRECEIVESIGLIST = [
#     "_wmbReceive(bytes,bytes32,uint256,address)"
# ];
#
# GCROSSCHAINSENDEVENTLIST = [
#     "CrossRequest"
# ];
#
# GCROSSCHAINRECEIVEEVENTLIST = [
#     "CrossArrive",
#     "CrossRevert"
# ];

#
# # For layerzero
#
# GCROSSCHAINSENDSIGLIST = ["send(uint16,bytes,bytes,address,address, bytes)", ]
# GCROSSCHAINRECEIVESIGLIST = ["receivePayload(uint16,bytes,address,uint64,uint,bytes)"]
# GCROSSCHAINSENDEVENTLIST = ["Locked"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Unlocked"]

# For Meter.io

# GCROSSCHAINSENDSIGLIST = ["deposit(uint8,bytes32,bytes)", "depositETH(uint8,bytes32,bytes)"]
# GCROSSCHAINRECEIVESIGLIST = ["executeProposal(uint8,uint64,bytes,bytes32)"]
# GCROSSCHAINSENDEVENTLIST = ["Deposit"]
# # crosschainsendstroagename
# GCROSSCHAINRECEIVEEVENTLIST = ["balanceOf"]
# GCROSSCHAINSENDCALLLIST = []
# GCROSSCHAINRECEIVECALLLIST = []




# For Near


# GCROSSCHAINSENDSIGLIST = ["lockToken(address,uint256,string)"]
# GCROSSCHAINRECEIVESIGLIST = ["unlockToken(bytes,uint64)"]
# GCROSSCHAINSENDEVENTLIST = ["Locked"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Unlocked"]
#
# # For omnibridge
#
# GCROSSCHAINSENDSIGLIST = ["bridgeSpecificActionsOnTokenTransfer(address,address,address,uint256,bytes)", ]
# GCROSSCHAINRECEIVESIGLIST = ["deployAndHandleBridgedTokens(address,string,string,uint8,address,uint256)"]
# GCROSSCHAINSENDEVENTLIST = ["TokensBridgingInitiated"]
# GCROSSCHAINRECEIVEEVENTLIST = ["TokensBridged"]
#
#
# # For Qbridge
# #
# GCROSSCHAINSENDSIGLIST = ["_bridge()"]
# GCROSSCHAINRECEIVESIGLIST = ["lockToken(address,uint256,address)"]
# GCROSSCHAINSENDEVENTLIST = ["BridgedSushi(address,uint256)"]
# GCROSSCHAINRECEIVEEVENTLIST = ["ProposalEvent"]
GCROSSCHAINSENDCALLLIST = []
GCROSSCHAINRECEIVECALLLIST = []


# {
#     "Type": "Relayer",
#     "Oracle": "none",
#     "Source_Function_Signature": [
#         "_bridge()"
#     ],
#     "Destination_Function_Signature": [
#         "lockToken(address,uint256,address)"
#     ],
#     "Source_Message_Event": [
#         "BridgedSushi(address,uint256)"
#     ],
#     "Source_Message_External_Call": [
#         "IHarmonyBridge.lockToken(address,uint256,address)"
#     ],
#     "Destination_Message_Event": [],
#     "Destination_Message_External_Call": []
# }
#
#
# # For Qrbit
#
# GCROSSCHAINSENDSIGLIST = ["deposit(string,bytes,bytes)", "depositToken(address,string,bytes,uint)", "depositToken(address,string,bytes,uint,bytes)", "depositNFT(address,string,bytes,uint)", "depositNFT(address,string,bytes,uint,bytes)"]
# GCROSSCHAINRECEIVESIGLIST = ["withdraw(address,string,bytes,address,address,bytes32[],uint[],bytes,uint8[],bytes32[],bytes32[])", "withdrawNFT(address,string,bytes,address,address,bytes32[],uint[],bytes,uint8[],bytes32[],bytes32[])"]
# GCROSSCHAINSENDEVENTLIST = ["Deposit", "DepositNFT"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Withdraw", "WithdrawNFT"]
#
#
#
#
# # For anySwapv4
#
# GCROSSCHAINSENDSIGLIST = ["anySwapOutExactTokensForNativeUnderlyingWithTransferPermit(address,uint,uint,address[],address,uint,uint8,bytes32,bytes32,uint)",
#                           "anySwapOutExactTokensForNativeUnderlying(uint,uint,address[],address,uint,uint)",
#                           "anySwapOutExactTokensForTokensUnderlyingWithTransferPermit(address,uint,uint,address[],address,uint,uint8,bytes32,bytes32,uint)",
#                           "anySwapOutExactTokensForTokensUnderlying(uint,uint,address[],address,uint,uint)",
#                           ]
# GCROSSCHAINRECEIVESIGLIST = ["anySwapInExactTokensForNative(bytes32,uint,uint,address[],address,uint,uint)",
#                              "anySwapInExactTokensForTokens(bytes32,uint,uint,address[],address,uint,uint)",
# ]
# GCROSSCHAINSENDEVENTLIST = ["LogAnySwapTradeTokensForTokens", "LogAnySwapTradeTokensForNative"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Withdraw", "WithdrawNFT"]
#
#
#
#
# # For RSK
#
# GCROSSCHAINSENDSIGLIST = ["receiveTokensTo(address,address,uint256)", "depositTo(address)"]
# GCROSSCHAINRECEIVESIGLIST = ["claim(address,uint256,bytes32,bytes32,uint32)"]
# GCROSSCHAINSENDEVENTLIST = ["Cross"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Claimed"]

# For merkle test
# GCROSSCHAINSENDSIGLIST = ["sendMessage(address,bytes)"]
# GCROSSCHAINRECEIVESIGLIST = ["executeCrossChainMessage(bytes32,bytes32[],address,bytes)"]
# GCROSSCHAINSENDEVENTLIST = ["MessageSent"]
# GCROSSCHAINRECEIVEEVENTLIST = ["MerkleRootAdded", "MessageExecuted"]
# GCROSSCHAINSENDCALLLIST = []
# GCROSSCHAINRECEIVECALLTLIST = []

#
#
# # For Synapse
#
# GCROSSCHAINSENDSIGLIST = ["deposit(address,uint256,address,uint256)",
#                           "redeem(address,uint256,address,uint256)",
#                           "depositAndSwap(address,uint256,address,uint256,uint8,uint8,uint256,uint256)",
#                           "redeemAndRemove(address,uint256,address,uint256,uint8,uint256,uint256)"
#                           ]
# GCROSSCHAINRECEIVESIGLIST = ["mint(address,address,uint256,uint256,bytes32)",
#                              "mintAndSwap(address,address,uint256,uint256,address,uint8,uint8,uint256,uint256,bytes32)",
#                              "withdraw(address,address,uint256,uint256,bytes32)",
#                              "withdrawAndRemove(address,address,uint256,uint256,address,uint8,uint256,uint256,bytes32)"]
# GCROSSCHAINSENDEVENTLIST = ["TokenDeposit", "TokenDepositAndSwap","TokenRedeemAndSwap", "TokenRedeemAndRemove"]
# GCROSSCHAINRECEIVEEVENTLIST = ["TokenMint", "TokenMintAndSwap", "TokenWithdrawAndRemove","TokenWithdraw"]

#
# GCROSSCHAINSENDSIGLIST = ["send(address,address,address,uint256,uint256)", "sendNative(address,uint256,uint64,uint64,uint32)"]
# GCROSSCHAINRECEIVESIGLIST = ["relay(bytes,bytes[],address[],uint256[])"]
# GCROSSCHAINSENDEVENTLIST = ["eventsend2"]
# GCROSSCHAINRECEIVEEVENTLIST = ["Relay"]
# XGRAPH = nx.Graph()

# def get_crosschain_send_sig_list():
#     return CROSSCHAINSENDSIGLIST
#
#
# def get_crosschain_receive_sig_list():
#     return CROSSCHAINRECEIVESIGLIST
#
#
# def get_crosschain_send_event_list():
#     return CROSSCHAINSENDEVENTLIST
#
#
# def get_crosschain_receive_event_list():
#     return CROSSCHAINRECEIVEEVENTLIST
