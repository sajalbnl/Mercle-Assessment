import axios from 'axios';
import { Elysia } from 'elysia';

const app = new Elysia();


const SOCKET_API_URL = 'https://api.socket.tech/v2/quote';
const API_KEY = '72a5b4b0-e727-48be-8aa1-5da9d62fe635'; 

// Fetch bridging routes from Socket API
async function getGasFeeForRoute(fromChainId: number, toChainId: number, amount: number, fromTokenAddress: string,toTokenAddress:string) {
    try {
        const response = await axios.get(SOCKET_API_URL, {
            params: {
                fromChainId: fromChainId,
                fromTokenAddress:fromTokenAddress,
                toChainId: toChainId,
                toTokenAddress:toTokenAddress,
                fromAmount: amount,
                userAddress:'0x3e8cB4bd04d81498aB4b94a392c334F5328b237b',
                uniqueRoutesPerBridge:true,
                sort:'gas',
                singleTxOnly:true
            },
            headers: {
                "API-KEY": API_KEY,
                Accept: "application/json",
                "Content-Type": "application/json",
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching bridging routes:', error);
        return null;
    }
}


type Chain = {
    name: string;
    balance: number;
    chainId: number; 
};

// Example chain balances in USDC
const userBalances: Chain[] = [
    { name: "Polygon", chainId: 137, balance: 50 * 1e6 },  // 50 USDC
    { name: "Arbitrum", chainId: 42161, balance: 100 * 1e6 }, // 100 USDC
    { name: "Base", chainId: 8453, balance: 80 * 1e6 },       // 80 USDC
    { name: "Gnosis", chainId: 100, balance: 25 * 1e6 },   // 25 USDC
    { name: "Blast", chainId: 81457, balance: 30 * 1e6 }   //30 USDC
];


// Function to find all combinations that fulfill the required amount on the target chain
function findAllCombinations(chains: Chain[], targetAmount: number) {
    const result: Array<Chain[]> = [];

    // Helper function for backtracking
    function backtrack(startIndex: number, currentRoute: Chain[], currentTotal: number) {
        // Check if current total meets or exceeds the target amount
        if (currentTotal >= targetAmount) {
            result.push([...currentRoute]); // Store the valid combination
            return; // Stop further exploration for this path
        }

        // Recursive case: try to add more chains to reach the target amount
        for (let i = startIndex; i < chains.length; i++) {
            if (chains[i].balance > 0) { // Ensure we only use balances greater than 0
                currentRoute.push(chains[i]);
                backtrack(i + 1, currentRoute, currentTotal + chains[i].balance); // Move to the next chain
                currentRoute.pop(); // Backtrack to explore other combinations
            }
        }
    }

    // Start the recursive search from the first chain
    backtrack(0, [], 0);

    return result;
}

// Main function to calculate valid combinations for bridging
function calculateBridging(targetChainId: number, amountRequired: number) {
    const targetChain = userBalances.find(chain => chain.chainId === targetChainId);

    if (!targetChain) {
        throw new Error("Target chain not found in user balances.");
    }

    const targetAmountInSmallestUnits = amountRequired * 1e6; // Convert to smallest units
    const remainingAmount = targetAmountInSmallestUnits - targetChain.balance; // Deduct target chain's balance

    // If the target chain's balance is already sufficient
    if (remainingAmount <= 0) {
        return [
            [
                {
                    from: targetChain.name,
                    amount: targetChain.balance / 1e6 // Convert back to human-readable USDC
                }
            ]
        ];
    }

    // Find combinations from other chains to cover the remaining amount
    const otherChains = userBalances.filter(chain => chain.chainId !== targetChainId);
    const combinations = findAllCombinations(otherChains, remainingAmount);

    // Format the output to show routes with the total bridged amount
    const formattedCombinations = combinations.map(combination => {
        const routes = combination.map(chain => ({
            from: chain.name,
            amount: chain.balance / 1e6 // Convert back to human-readable USDC
        }));

        // Include the target chain in the output
        return [
            ...routes,
            {
                from: targetChain.name,
                amount: targetChain.balance / 1e6 // Add the target chain amount if needed
            }
        ];
    });

    return formattedCombinations;
}

// Example Usage
const targetChainId = 137;  // Target chain is Polygon (id: 137)
const targetAmount = 70;  // 70 USDC required on the target chain
console.log(calculateBridging(targetChainId, targetAmount));
