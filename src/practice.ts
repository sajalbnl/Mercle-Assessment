import axios from 'axios';

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

// Example API constants
const SOCKET_API_URL = 'https://api.socket.tech/v2/quote';
const API_KEY = '72a5b4b0-e727-48be-8aa1-5da9d62fe635'; 
// Function to find all combinations that fulfill the required amount on the target chain
function findAllCombinations(chains: Chain[], targetAmount: number) {
    const result: Array<Chain[]> = [];

    // Helper function for backtracking
    function backtrack(startIndex: number, currentRoute: Chain[], currentTotal: number) {
        if (currentTotal >= targetAmount) {
            result.push([...currentRoute]);
            return;
        }

        for (let i = startIndex; i < chains.length; i++) {
            if (chains[i].balance > 0) {
                currentRoute.push(chains[i]);
                backtrack(i + 1, currentRoute, currentTotal + chains[i].balance);
                currentRoute.pop();
            }
        }
    }

    backtrack(0, [], 0);
    return result;
}

// Function to get gas fee for a single route
async function getGasFeeForRoute(fromChainId: number, toChainId: number, amount: number, fromTokenAddress: string, toTokenAddress: string) {
    try {
        const response = await axios.get(SOCKET_API_URL, {
            params: {
                fromChainId: fromChainId,
                fromTokenAddress: fromTokenAddress,
                toChainId: toChainId,
                toTokenAddress: toTokenAddress,
                fromAmount: amount,
                userAddress: '0x3e8cB4bd04d81498aB4b94a392c334F5328b237b',
                uniqueRoutesPerBridge: true,
                sort: 'gas',
                singleTxOnly: true
            },
            headers: {
                "API-KEY": API_KEY,
                Accept: "application/json",
                "Content-Type": "application/json",
            }
        });
        return response.data; // Assume this returns the gas fee in some form
    } catch (error) {
        console.error('Error fetching bridging routes:', error);
        return null;
    }
}

// Main function to calculate valid combinations for bridging and their gas fees
async function calculateBridging(targetChainId: number, amountRequired: number) {
    const targetChain = userBalances.find(chain => chain.chainId === targetChainId);

    if (!targetChain) {
        throw new Error("Target chain not found in user balances.");
    }

    const targetAmountInSmallestUnits = amountRequired * 1e6; // Convert to smallest units
    const remainingAmount = targetAmountInSmallestUnits - targetChain.balance;

    if (remainingAmount <= 0) {
        return [
            [
                {
                    from: targetChain.name,
                    amount: targetChain.balance / 1e6
                }
            ]
        ];
    }

    const otherChains = userBalances.filter(chain => chain.chainId !== targetChainId);
    const combinations = findAllCombinations(otherChains, remainingAmount);

    // Calculate gas fees for each combination
    const gasFeePromises = combinations.map(async (combination) => {
        const gasFees = await Promise.all(combination.map(async (chain) => {
            // Here, you need to provide the correct `toChainId` and token addresses
            const gasFee = await getGasFeeForRoute(chain.chainId, targetChain.chainId, chain.balance / 1e6, 'FROM_TOKEN_ADDRESS', 'TO_TOKEN_ADDRESS');
            return gasFee ? gasFee.cost : 0; // Adjust as per the response structure
        }));

        // Sum up the gas fees for this combination
        return gasFees.reduce((total, fee) => total + fee, 0);
    });

    // Wait for all gas fee calculations to complete
    const totalGasFees = await Promise.all(gasFeePromises);

    // Find the combination with the least gas fee
    const minGasFeeIndex = totalGasFees.indexOf(Math.min(...totalGasFees));
    const bestCombination = combinations[minGasFeeIndex];

    // Format the output for the best combination
    const bestRoutes = bestCombination.map(chain => ({
        from: chain.name,
        amount: chain.balance / 1e6
    }));

    return [
        bestRoutes,
        totalGasFees[minGasFeeIndex]
    ];
}

// Example Usage
const targetChainId = 137;  // Target chain is Polygon (id: 137)
const targetAmount = 70;  // 70 USDC required on the target chain
calculateBridging(targetChainId, targetAmount).then(result => {
    console.log('Best Combination:', result[0]);
    console.log('Total Gas Fee:', result[1]);
}).catch(error => {
    console.error('Error calculating bridging:', error);
});
