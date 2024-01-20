"use client";
import MessageHistory from '@/components/MessageHistory';
import SendMessage from '@/components/SendMessage';
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function Home() {

  const {address} = useAccount();

  return (
    <main className="container max-w-xl mx-auto">
      <div className='flex flex-col h-screen justify-between gap-5 '>
        <div className='py-5 flex justify-between items-center'>
          <ConnectButton />
          <Link href="/stackup" className='text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'>ERC4337 Method</Link>
        </div>
        <MessageHistory address={address} />
        <SendMessage />
      </div>
    </main>
  )
}
