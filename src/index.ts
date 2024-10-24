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

// Example balances of USDC on different chains
const userBalances: { [key: string]: number } = {
    Polygon: 50 * 1e6,  // 50 USDC
    Arbitrum: 100 * 1e6, // 100 USDC
    Base: 80 * 1e6,      // 80 USDC
};


async function calculateBridging(targetChainId: number, amountRequired: number, tokenAddress: string) {
    // Placeholder object to store routes
    let routes = [];
    let totalBridged = 0;
    let remainingAmount = amountRequired;

    // Hardcoded Chains and their tokenAddress for USDC
    const chains = [
        { name: "Polygon", id: 137, tokenAddress:"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"},
        { name: "Arbitrum", id: 42161,tokenAddress:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
        { name: "Base", id: 8453,tokenAddress:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }
    ];

    // Iterate over available chains (Polygon, Arbitrum, Base) to get bridging quotes
    for (const chain of chains) {
        const balance = userBalances[chain.name];
        
        if (balance > 0) {
            // Get bridging route from Socket API
            const routeData = await getGasFeeForRoute(chain.id, targetChainId, remainingAmount, tokenAddress,chain.tokenAddress);
            
            if (routeData && routeData.result) {
                const estimatedAmount = routeData.result.toAmount;
                var fee =  0;
                if(routeData.result.routes.length-1 != 0){
                    fee=routeData.result.routes[routeData.result.routes.length-1]?.totalGasFeesInUsd || 0;
                }
                
                
                if (estimatedAmount > 0) {
                    const amountToBridge = Math.min(estimatedAmount, remainingAmount);
                    totalBridged += amountToBridge;

                    routes.push({
                        from: chain.name,
                        to: targetChainId,
                        amount: amountToBridge / 1e6,  // Convert to human-readable format (e.g., USDC)
                        fee: fee / 1e6
                    });

                    remainingAmount -= amountToBridge;
                }

                // If the required amount is fully bridged, break the loop
                if (remainingAmount <= 0) break;
            }
        }
    }

    return {
        totalBridged: totalBridged / 1e6,  // Convert to human-readable USDC format
        routes,
        remainingAmount: remainingAmount / 1e6  // Convert to human-readable USDC format
    };
}


app.get("/bridge", async (req) => {
    const { targetChain, amount, tokenAddress } = req.query;

    const result = await calculateBridging(Number(targetChain), Number(amount), tokenAddress  || "");
    return result;
});

// Start the server on port 3000
app.listen(8000, () => {
    console.log('Server is running on http://localhost:8000');
});

