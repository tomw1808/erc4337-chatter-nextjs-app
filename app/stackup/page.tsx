"use client";
import MessageHistory from '@/components/MessageHistory';
import SendMessage from '@/components/SendMessage';
import { useEthersSigner } from '@/lib/ethers';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { Presets, Client } from "userop";
import { Message } from '@/lib/types/Message';
import { encodeFunctionData, getAddress } from 'viem';
import { useAccount, useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';
import Link from 'next/link';

const rpcUrl = `https://api.stackup.sh/v1/node/${process.env.NEXT_PUBLIC_STACKUP_API}`;
const paymasterUrl = `https://api.stackup.sh/v1/paymaster/${process.env.NEXT_PUBLIC_STACKUP_PAYMASTER}`; // Optional - you can get one at https://app.stackup.sh/


// const chatterjson = require("../../../chatter-contracts/out/Chatter.sol/Chatter.json");
import chatterabi from "@/lib/chatter";
const chatterAddress = process.env.NEXT_PUBLIC_CHATTER_ADDRESS as `0x${string}`;

export default function Stackup() {

    const [connectedAddress, setConnectedAddress] = useState<`0x${string}` | undefined>();
    const { address } = useAccount();

    const signer = useEthersSigner();

    const [useSmartWallet, SetUseSmartWallet] = useState<boolean>(true);

    const [builder, setBuilder] = useState<Presets.Builder.SimpleAccount>();


    const [pendingMessage, SetPendingMessage] = useState<Message | undefined>();
    const [pendingIcon, SetPendingIcon] = useState<string>("");

    useEffect(() => {
        console.log(useSmartWallet)
        if (useSmartWallet && signer) {
            setConnectedAddress(undefined);
            const paymasterContext = { type: "payg" };
            const paymasterMiddleware = Presets.Middleware.verifyingPaymaster(
                paymasterUrl,
                paymasterContext
            );
            const opts = paymasterUrl === "" ? {} : {
                paymasterMiddleware: paymasterMiddleware,
            }
            Presets.Builder.SimpleAccount.init(signer, rpcUrl, opts).then(builder => {
                const smartWalletAddress = builder.getSender();
                console.log(`Account address: ${address} with smart wallet address ${smartWalletAddress}`);
                setConnectedAddress(smartWalletAddress as `0x${string}`);
                setBuilder(builder);
            })

        } else {
            setConnectedAddress(address);
        }
    }, [useSmartWallet])

    const [message, setMessage] = useState<string>("");


    const { config, error } = usePrepareContractWrite({
        address: chatterAddress,
        abi: chatterabi,
        functionName: 'sendMessage',
        args: [message]
    })
    const { write, data } = useContractWrite(config);

    function sendMessage() {
        if (message && message.length > 0 && connectedAddress) {
            if (useSmartWallet) {
                if (builder) {
                    SetPendingIcon("🧐")
                    const pendingLog: Message = {
                        args: {
                            sender: connectedAddress,
                            message
                        }
                    }
                    SetPendingMessage(pendingLog);


                    // Encode the calls
                    const callTo = [chatterAddress];
                    const data = encodeFunctionData({
                        abi: chatterabi,
                        functionName: 'sendMessage',
                        args: [message]
                    })
                    const callData = [data]
                    // Send the User Operation to the ERC-4337 mempool
                    Client.init(rpcUrl).then(async client => {
                        SetPendingIcon("⏱️")

                        const res = await client.sendUserOperation(builder.executeBatch(callTo, callData), {
                            onBuild: (op) => console.log("Signed UserOperation:", op),
                        });

                        SetPendingIcon("📩")

                        // Return receipt
                        console.log(`UserOpHash: ${res.userOpHash}`);
                        console.log("Waiting for transaction...");
                        const ev = await res.wait();
                        SetPendingIcon("✅")

                        SetPendingMessage(undefined);
                        console.log(`Transaction hash: ${ev?.transactionHash ?? null}`);
                        console.log(`View here: https://jiffyscan.xyz/userOpHash/${res.userOpHash}`);
                    })
                }
            } else {
                write?.();
            }
        }
    }

    const { isLoading, isSuccess } = useWaitForTransaction({
        hash: data?.hash,
        onSettled() {
            setMessage("");
        }
    })

    return (
        <main className="container max-w-xl mx-auto">
            <div className='flex flex-col h-screen justify-between gap-5 '>
                <div className='flex flex-col gap-5 py-5'>
                    <div className='flex justify-between items-center'>
                        <ConnectButton />
                        <div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={useSmartWallet} className="sr-only peer" onChange={() => { SetUseSmartWallet(!useSmartWallet) }} />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Smart Wallet</span>
                            </label>

                        </div>
                        <Link href="/" className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'>EOA Method</Link>

                    </div>
                    <div className='flex justify-between items-center'>
                        Stackup Wallet Account: {connectedAddress}
                    </div>
                </div>
                <MessageHistory address={connectedAddress} pendingIcon={pendingIcon} pendingMessage={pendingMessage} SetPendingMessage={SetPendingMessage} />
                <div className="flex w-full p-5 border-t-2">
                    <input
                        type='text'
                        value={message}
                        onChange={(e) => { setMessage(e.target.value) }}
                        onKeyDown={event => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                sendMessage();
                            }
                        }}
                        placeholder='Hi there...'
                        className="w-full text-gray-600 p-3 bg-gray-200 rounded-l-md focus:outline-none focus:placeholder-gray-300"
                    />
                    <button
                        onClick={(e) => { e.preventDefault(), sendMessage() }}
                        type='button'
                        className="px-4 py-3 bg-blue-500 rounded-r-lg hover:bg-blue-400 ease-in-out duration-500"
                    >📩</button>
                </div>
            </div>
        </main>
    )
}
