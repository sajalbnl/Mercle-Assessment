import axios from 'axios';
import { Elysia } from 'elysia';

const app = new Elysia();


const SOCKET_API_URL = 'https://api.socket.tech/v2/quote';
const API_KEY = '72a5b4b0-e727-48be-8aa1-5da9d62fe635'; 

// Fetch gas fee for bridging routes from Socket API
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
    tokenAddress:string 
};

// Example chain balances in USDC
const userBalances: Chain[] = [
    { name: "Polygon", chainId: 137, balance: 50 * 1e6,tokenAddress:"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },  // 50 USDC
    { name: "Arbitrum", chainId: 42161, balance: 100 * 1e6,tokenAddress:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831" }, // 100 USDC
    { name: "Base", chainId: 8453, balance: 80 * 1e6,tokenAddress:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },       // 80 USDC
];

// Ignoring combination of inter routing like first base to arbitrum then to target chain

// Function to find all combinations that fulfill the required amount
function findAllCombinations(chains: Chain[], targetAmount: number) {
    const result: Array<Chain[]> = [];

    // Helper function for backtracking
    function backtrack(startIndex: number, currentRoute: Chain[], currentTotal: number) {
        // Check if current total meets or exceeds the target amount
        if (currentTotal >= targetAmount) {
            result.push([...currentRoute]); // Store the  combination
            return; // Stop further exploration for this path
        }

        // Try to add more chains to reach the target amount
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


// Main function to calculate valid combinations for bridging on target chain
function calculateBridging(targetChainId: number, amountRequired: number) {
    const targetChain = userBalances.find(chain => chain.chainId === targetChainId);

    if (!targetChain) {
        throw new Error("Target chain not found in user balances.");
    }

    const targetAmountInSmallestUnits = amountRequired * 1e6; // Convert to smallest units
    const remainingAmount = targetAmountInSmallestUnits - targetChain.balance; // Deduct target chain's balance

    // Find combinations from other chains to cover the remaining amount
    const otherChains = userBalances.filter(chain => chain.chainId !== targetChainId);
    const combinations = findAllCombinations(otherChains, remainingAmount);

    // Format the output to show routes with the total bridged amount
    const formattedCombinations = combinations.map(combination => {
        const routes = combination.map(chain => ({
            from: chain.chainId,
            to:targetChain.chainId,
            fromTokenAddress:chain.tokenAddress,
            toTokenAddress:targetChain.tokenAddress,
            amount: chain.balance / 1e6 // Convert back to human-readable USDC
        }));

    
        return [
            ...routes,
        ];
    });

    return formattedCombinations;
}


// Function to calculate gas fee for all combinations and return the combination with the least gas fee
async function calculateEfficientRoute(targetChainId: number, amountRequired: number, tokenAddress: string) {
    // Get all possible bridging combinations
    const combinations = calculateBridging(targetChainId, amountRequired);
    
    let lowestGasFeeCombination = null;
    let lowestTotalGasFee = Number.MAX_VALUE; // Initialize with a large value
    
    // Iterate through each combination
    for (const combination of combinations) {
        // Fetch gas fees for all routes in this combination in parallel
        const gasFeePromises = combination.map(route => {
            const { from, to, fromTokenAddress, toTokenAddress, amount } = route;
            return getGasFeeForRoute(from, to, amount * 1e6, fromTokenAddress, toTokenAddress); // Convert amount to smallest units
        });

        // Wait for all gas fee promises to resolve
        const gasFeeResults = await Promise.all(gasFeePromises);

        // Calculate the total gas fee for this combination using totalGasFeesInUsd
        let totalGasFee = 0;
        for (const gasFeeData of gasFeeResults) {
            if (gasFeeData && gasFeeData.success && gasFeeData.result.routes.length > 0) {
                // Get the totalGasFeesInUsd from the first route in the response
                const gasFeeForRoute = gasFeeData.result.routes[gasFeeData.result.routes.length-1].totalGasFeesInUsd;
                totalGasFee += gasFeeForRoute;
            } else {
                console.error('Error fetching gas fee for a route in combination.');
                totalGasFee = Number.MAX_VALUE; // Skip this combination by setting a high gas fee
                break; // Skip further processing if there's an issue
            }
        }

        // Check if this combination has the lowest gas fee so far
        if (totalGasFee < lowestTotalGasFee) {
            lowestTotalGasFee = totalGasFee;
            lowestGasFeeCombination = combination;
        }
    }

    // Return the combination with the least gas fee
    return {
        combination: lowestGasFeeCombination,
        totalGasFee: lowestTotalGasFee // Gas fee is already in USD
    };
}


// const targetChainId = 137; // Example target chain
// const amountRequired = 200; // Amount required in USDC
// const tokenAddress = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // Example token address

// calculateEfficientRoute(targetChainId, amountRequired, tokenAddress).then(result => {
//     console.log("Cheapest Route:", result.combination);
//     console.log("Total Gas Fee (in USDC):", result.totalGasFee);
// });

app.get("/bridge", async (req) => {
    const { targetChainId, amount, tokenAddress } = req.query;

    // Calculate efficient route
    const result = await calculateEfficientRoute(
        Number(targetChainId) || 137,
        Number(amount),
        tokenAddress || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
    );

    // If no combination is found, return an insufficient balance message
    if (!result.combination || result.combination.length === 0) {
        return {
            message: "Insufficient balance."
        };
    }

    // Otherwise, return the combination with the total gas fee
    return {
        message: "Cheapest Route Found",
        combination: result.combination,
        totalGasFee: result.totalGasFee
    };
});


// Start the server on port 7000
app.listen(7000, () => {
    console.log('Server is running on http://localhost:7000');
});
