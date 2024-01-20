"use client";
import MessageHistory from '@/components/MessageHistory';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useState } from 'react';
import { encodeFunctionData, toHex } from 'viem';

const wethABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"guy","type":"address"},{"name":"wad","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"src","type":"address"},{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"dst","type":"address"},{"name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"guy","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"dst","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"src","type":"address"},{"indexed":false,"name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"}];

import {
    LightSmartContractAccount,
    getDefaultLightAccountFactoryAddress,
} from "@alchemy/aa-accounts";
import { AlchemyProvider } from "@alchemy/aa-alchemy";
import { sepolia } from "viem/chains";

import { useAccount, useChainId, useContractWrite, usePrepareContractWrite, usePublicClient, useWaitForTransaction, useWalletClient } from 'wagmi';
import { WalletClientSigner } from '@alchemy/aa-core';


const chain = sepolia;

const ALCHEMY_API_KEY = "4-Rnsg3zDaSTx-XWX8ccMuYGD0tBm7cr";

// const chatterjson = require("../../../chatter-contracts/out/Chatter.sol/Chatter.json");
import chatterabi from "@/lib/chatter";
const chatterAddress = "0x3fb2668216544c03e98b2be9121ddd4ef469a613";

export default function Stackup() {

    const [connectedAddress, setConnectedAddress] = useState<`0x${string}` | undefined>();
    const { address } = useAccount();

    const [useSmartWallet, SetUseSmartWallet] = useState<boolean>(false);

    const { data: walletClient } = useWalletClient();

    const [provider, SetProvider] = useState<AlchemyProvider>();


    useEffect(() => {
        if (useSmartWallet) {
            setConnectedAddress(undefined);
            if (walletClient) {
                // Create a provider to send user operations from your smart account
                const provider = new AlchemyProvider({
                    // get your Alchemy API key at https://dashboard.alchemy.com
                    apiKey: ALCHEMY_API_KEY,
                    chain,
                }).connect(
                    (rpcClient) =>
                        new LightSmartContractAccount({
                            rpcClient,
                            owner: new WalletClientSigner(walletClient, "json-rpc"),
                            chain,
                            factoryAddress: getDefaultLightAccountFactoryAddress(chain),
                        })
                );

                SetProvider(provider);

                provider.getAddress().then(addr => {
                    console.log({ addr });
                    setConnectedAddress(addr);
                })
            }
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

    async function sendMessage() {
        if (message && message.length > 0) {
            if (useSmartWallet) {
                if (provider) {

                    const data = encodeFunctionData({
                        abi: chatterabi,
                        functionName: 'sendMessage',
                        args: [message]
                    })
                    const { hash: uoHash } = await provider.sendUserOperation({
                        target: chatterAddress, // The desired target contract address
                        data: data, // The desired call data
                    });

                    console.log("UserOperation Hash: ", uoHash); // Log the user operation hash

                    // Wait for the user operation to be mined
                    const txHash = await provider.waitForUserOperationTransaction(uoHash);

                    console.log("Transaction Hash: ", txHash); // Log the transaction hash
                }
            }

        } else {
            write?.();
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
                    </div>
                    <div className='flex justify-between items-center'>
                        Account: {connectedAddress}
                    </div>
                </div>
                <MessageHistory address={connectedAddress} />
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
