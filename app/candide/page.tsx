"use client";
import MessageHistory from '@/components/MessageHistory';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { Log, encodeFunctionData, getAddress, toHex } from 'viem';
import {
    CandideAccount, Operation,
    GasEstimationResult,
    UserOperation,
    UserOperationEmptyValues, Bundler, getUserOperationHash, CandideValidationPaymaster
} from "abstractionkit";

import entrypointabi from "../../lib/entrypoint";

import { useAccount, useChainId, useContractWrite, usePrepareContractWrite, usePublicClient, useWaitForTransaction, useWalletClient } from 'wagmi';
import JazziconImage from '@/components/JazziconImage';
import { Message } from '@/lib/types/Message';
import waitForUserOperationTransaction from '@/lib/waitForTx';
import Link from 'next/link';

const rpcUrl = "https://sepolia.test.voltaire.candidewallet.com/rpc";

// const paymasterApiKey = "b176764585ecc51edc387ef3ac8c6a36";;
// const paymasterRpc = `https://api.candide.dev/paymaster/v1/goerli/${paymasterApiKey}`;


const chatterjson = require("../../../chatter-contracts/out/Chatter.sol/Chatter.json");
const chatterAddress = process.env.NEXT_PUBLIC_CHATTER_ADDRESS as `0x${string}`;

const entrypointAddress = process.env.NEXT_PUBLIC_ENTRYPOINT_ADDRESS as `0x${string}`;
;

const naivePaymasterThatPaysEverything = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS as `0x${string}`;

export default function CandideSafeWallet() {

    const [connectedAddress, setConnectedAddress] = useState<`0x${string}`>("0x0000000000000000000000000000000000000000");
    const { address, isConnected } = useAccount();

    const [pendingMessage, SetPendingMessage] = useState<Message | undefined>();
    const [pendingIcon, SetPendingIcon] = useState<string>("");

    const [useSmartWallet, SetUseSmartWallet] = useState<boolean>(true);
    const [initCode, SetInitCode] = useState<`0x${string}`>();

    const publicClient = usePublicClient();
    const { data: walletClient } = useWalletClient();

    const [errorMessage, SetErrorMessage] = useState<string | undefined>();


    const chainId = useChainId();


    useEffect(() => {
        if (address) {
            setConnectedAddress(address);
        } else {
            setConnectedAddress("0x0000000000000000000000000000000000000000");
        }
        if (useSmartWallet && address) {

            const smartAccount = new CandideAccount(address); //new SafeAccount(address);
            const [newAccountAddress, walletInitCode] = smartAccount.createNewAccount([
                address,
            ]);
            console.log({ newAccountAddress, walletInitCode });
            SetInitCode(walletInitCode as `0x${string}`);
            setConnectedAddress(getAddress(newAccountAddress));
        }
    }, [useSmartWallet, chainId, address])

    const [message, setMessage] = useState<string>("");


    const { config, error } = usePrepareContractWrite({
        address: chatterAddress,
        abi: chatterjson.abi,
        functionName: 'sendMessage',
        args: [message]
    })
    const { write, data } = useContractWrite(config);

    async function sendMessage() {
        if (message && message.length > 0 && connectedAddress) {
            try {
                //lock input field
                //set pending message
                SetErrorMessage(undefined);

                SetPendingIcon("🧐")
                const pendingLog: Message = {
                    args: {
                        sender: getAddress(connectedAddress),
                        message
                    }
                }
                SetPendingMessage(pendingLog);
                const smartAccount = new CandideAccount(); //new SafeAccount();
                const data = encodeFunctionData({
                    abi: chatterjson.abi,
                    functionName: 'sendMessage',
                    args: [message]
                });

                const callData = smartAccount.createCallDataSingleTransaction({
                    to: chatterAddress,
                    value: 0,
                    data,
                    operation: Operation.Call,
                });

                const bundler: Bundler = new Bundler(rpcUrl, entrypointAddress);

                const nonce = await publicClient.readContract({
                    address: entrypointAddress,
                    abi: entrypointabi,
                    functionName: 'getNonce',
                    args: [connectedAddress, BigInt(0)]
                });
                console.log(nonce);

                let user_operation: UserOperation = {
                    ...UserOperationEmptyValues,
                    sender: connectedAddress as string,
                    nonce: nonce > 0 ? toHex(nonce) : "0x00",
                    initCode: nonce > 0 ? '0x' : initCode as string,
                    callData,
                };


                SetPendingIcon("🧮")
                let estimation = await bundler.estimateUserOperationGas(user_operation) as GasEstimationResult;
                console.log(estimation);

                // catch errors if there's any in the estimateUserOperationGas call
                if ("code" in estimation) {
                    throw new Error(estimation.message)
                    return
                }

                user_operation.callGasLimit = toHex(
                    Math.round(Number(estimation.callGasLimit) * 1.2)
                );

                user_operation.preVerificationGas = toHex(
                    Math.round(Number(estimation.preVerificationGas) * 1.2)
                );

                user_operation.verificationGasLimit = toHex(
                    Math.round(Number(estimation.verificationGasLimit) * 2)
                );


                const {
                    maxFeePerGas,
                    maxPriorityFeePerGas
                } = await publicClient.estimateFeesPerGas();

                console.log(maxFeePerGas, maxPriorityFeePerGas)
                if (maxFeePerGas && maxPriorityFeePerGas) {
                    user_operation.maxFeePerGas = toHex(
                        Math.round(Number(maxFeePerGas) * 1.5)
                    );

                    user_operation.maxPriorityFeePerGas = toHex(
                        Math.round(Number(maxPriorityFeePerGas) * 1.5)
                    );
                }

                console.log(user_operation)


                /**
                 * We are not using the Candide paymaster here, I'm using a Naive Paymaster that pays for everything.
                 * Do not do that in production! 
                 * 
                 * The reason is, I do not want to offer any kind of token-ecosystem. Instead I funded a smart contract that simply pays for the transaction.
                 * 
                 * In an ideal world you create some sort of net zero or net positive economy. 
                 * 
                 * 
                 * That is the paymaster that pays as long as its funded: https://goerli.etherscan.io/address/0x7849ad9720d44880dabf565e1a16aeefb2d0dc39
                 */
                user_operation.paymasterAndData = naivePaymasterThatPaysEverything;
                // const paymaster: CandideValidationPaymaster = new CandideValidationPaymaster(
                //     entrypointAddress,
                //     paymasterRpc
                // );

                // SetPendingIcon("💸")

                // const paymasterResult = await paymaster.getPaymasterCallDataForGaslessTx(
                //     user_operation,
                // );

                // console.log({ paymasterResult })

                // if (paymasterResult.paymasterAndData) {
                //     user_operation.paymasterAndData = paymasterResult.paymasterAndData;

                //     // replace new gas fields if provided by paymaster Result
                //     user_operation.callGasLimit = paymasterResult.callGasLimit ?? user_operation.callGasLimit;
                //     user_operation.preVerificationGas = paymasterResult.preVerificationGas ?? user_operation.preVerificationGas;
                //     user_operation.verificationGasLimit = paymasterResult.verificationGasLimit ?? user_operation.verificationGasLimit;
                //     user_operation.maxFeePerGas = paymasterResult.maxFeePerGas ?? user_operation.maxFeePerGas;
                //     user_operation.maxPriorityFeePerGas = paymasterResult.maxPriorityFeePerGas ?? user_operation.maxPriorityFeePerGas;
                // } else {
                //     console.log("Please add a gas policy to sponsor this user operation");
                // }



                const user_operation_hash = getUserOperationHash(
                    user_operation,
                    entrypointAddress,
                    chainId
                );

                console.log({ user_operation_hash })

                SetPendingIcon("✍🏻")
                user_operation.signature = await walletClient?.signMessage({
                    // Hex data representation of message.
                    message: { raw: user_operation_hash as `0x${string}` },
                }) as string
                const bundlerResponse = await bundler.sendUserOperation(user_operation);

                console.log(bundlerResponse, "bundlerResponse");

                if ("message" in bundlerResponse) {
                    throw new Error(bundlerResponse.message)
                }

                SetPendingIcon("⏳")
                const txHash = await waitForUserOperationTransaction(bundlerResponse.userOperationHash as `0x${string}`, bundler);
                console.log({ txHash })
                SetPendingMessage(undefined);
            } catch (e: any) {
                //remove pendingMessage
                SetPendingMessage(undefined);
                SetErrorMessage(e.message ?? e.toString())
            }
        }


    }

    return (
        <main className="container max-w-xl mx-auto">
            <div className='flex flex-col h-screen justify-between gap-5 '>
                <div className='flex flex-col gap-5 py-5'>
                    <div className='flex justify-between items-center'>
                        <ConnectButton />
                        {isConnected && <div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={useSmartWallet} className="sr-only peer" onChange={() => { SetUseSmartWallet(!useSmartWallet) }} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Smart Wallet</span>
                            </label>


                        </div>}
                        <Link href="/" className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'>EOA Method</Link>

                    </div>
                    {isConnected && <div className='flex justify-between items-center'>
                        Account: {connectedAddress && <JazziconImage address={connectedAddress} className='h-6 w-6 rounded-full' />} {connectedAddress}
                    </div>
                    }
                </div>
                <MessageHistory address={getAddress(connectedAddress)} pendingMessage={pendingMessage} pendingIcon={pendingIcon} SetPendingMessage={SetPendingMessage} />
                <div className="flex flex-col w-full p-5 border-t-2">
                    <div className='text-red-500'>{errorMessage}</div>
                    <div className='flex w-full'>
                        <input
                            type='text'
                            value={message}
                            disabled={pendingMessage !== undefined || !isConnected}
                            onChange={(e) => { setMessage(e.target.value) }}
                            onKeyDown={event => {
                                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                    sendMessage();
                                }
                            }}
                            placeholder='Hi there...'
                            className="w-full text-gray-600 disabled:placeholder-gray-300 disabled:bg-gray-100 p-3 bg-gray-200 rounded-l-md focus:outline-none focus:placeholder-gray-300"
                        />
                        <button
                            onClick={(e) => { e.preventDefault(), sendMessage() }}
                            disabled={pendingMessage !== undefined || !isConnected}
                            type='button'
                            className="px-4 py-3 bg-blue-500 rounded-r-lg hover:bg-blue-400 ease-in-out duration-500 disabled:bg-gray-300"
                        >📩</button>
                    </div>
                </div>
            </div>
        </main >
    )
}
