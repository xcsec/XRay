import { useFormikContext } from "formik";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { SwapFormValues } from "../DTOs/SwapFormValues";
import NumericInput from "./NumericInput";
import { useBalancesState } from "../../context/balances";
import { truncateDecimals } from "../utils/RoundDecimals";
import { useFee } from "../../context/feeContext";
import dynamic from "next/dynamic";
import { useQueryState } from "../../context/query";

const MinMax = dynamic(() => import("./dynamic/MinMax"), {
    loading: () => <></>,
});

const AmountField = forwardRef(function AmountField(_, ref: any) {

    const { values, handleChange } = useFormikContext<SwapFormValues>();
    const [requestedAmountInUsd, setRequestedAmountInUsd] = useState<string>();
    const { fromCurrency, from, to, amount, toCurrency, fromExchange, toExchange } = values || {};
    const { minAllowedAmount, maxAllowedAmount: maxAmountFromApi } = useFee()
    const [isFocused, setIsFocused] = useState(false);
    const { balances, isBalanceLoading, gases, isGasLoading } = useBalancesState()
    const [walletAddress, setWalletAddress] = useState<string>()
    const native_currency = from?.token
    const query = useQueryState()

    const gasAmount = gases[from?.name || '']?.find(g => g?.token === fromCurrency?.symbol)?.gas || 0
    const name = "amount"
    const walletBalance = walletAddress && balances[walletAddress]?.find(b => b?.network === from?.name && b?.token === fromCurrency?.symbol)
    let maxAllowedAmount: number | null = maxAmountFromApi || 0
    if (query.balances && fromCurrency) {
        try {
            const balancesFromQueries = new URL(window.location.href.replaceAll('&quot;', '"')).searchParams.get('balances');
            const parsedBalances = balancesFromQueries && JSON.parse(balancesFromQueries)
            let balancesTyped = parsedBalances
            if (balancesTyped && balancesTyped[fromCurrency.symbol] && balancesTyped[fromCurrency.symbol] > Number(minAllowedAmount)) {
                maxAllowedAmount = Math.min(maxAllowedAmount, balancesTyped[fromCurrency.symbol]);
            }
        }
        // in case the query parameter had bad formatting just ignoe
        catch { }
    } else if (walletBalance && (walletBalance.amount >= Number(minAllowedAmount) && walletBalance.amount <= Number(maxAmountFromApi))) {
        if (((native_currency?.symbol === fromCurrency?.symbol) || !native_currency) && ((walletBalance.amount - gasAmount) >= Number(minAllowedAmount) && (walletBalance.amount - gasAmount) <= Number(maxAmountFromApi))) {
            maxAllowedAmount = walletBalance.amount - gasAmount
        }
        else maxAllowedAmount = walletBalance.amount
    }
    else {
        maxAllowedAmount = Number(maxAmountFromApi) || 0
    }

    const maxAllowedDisplayAmount = maxAllowedAmount && truncateDecimals(maxAllowedAmount, fromCurrency?.precision)

    const placeholder = (fromCurrency && toCurrency && from && to && minAllowedAmount && !isBalanceLoading && !isGasLoading) ? `${minAllowedAmount} - ${maxAmountFromApi}` : '0.0'
    const step = 1 / Math.pow(10, fromCurrency?.precision || 1)
    const amountRef = useRef(ref)

    const diasbled = Boolean((fromExchange && !toCurrency) || (toExchange && !fromCurrency))

    const updateRequestedAmountInUsd = useCallback((requestedAmount: number) => {
        if (fromCurrency?.price_in_usd && !isNaN(requestedAmount)) {
            setRequestedAmountInUsd((fromCurrency?.price_in_usd * requestedAmount).toFixed(2));
        } else {
            setRequestedAmountInUsd(undefined);
        }
    }, [requestedAmountInUsd, fromCurrency]);

    useEffect(() => {
        amount && updateRequestedAmountInUsd(Number(amount))
    }, [amount, fromCurrency])

    return (<>
        <p className="block font-semibold text-secondary-text text-xs mb-1">Amount</p>
        <div className="flex w-full justify-between bg-secondary-700 rounded-lg">
            <div className="relative w-full">
                <NumericInput
                    disabled={diasbled}
                    placeholder={placeholder}
                    min={minAllowedAmount}
                    max={maxAllowedAmount || 0}
                    step={isNaN(step) ? 0.01 : step}
                    name={name}
                    ref={amountRef}
                    precision={fromCurrency?.precision}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    className="text-primary-text pr-0 w-full"
                    onChange={e => {
                        /^[0-9]*[.,]?[0-9]*$/.test(e.target.value) && handleChange(e);
                        updateRequestedAmountInUsd(parseFloat(e.target.value));
                    }}
                >
                    {requestedAmountInUsd && Number(requestedAmountInUsd) > 0 && !isFocused ? (
                        <span className="absolute text-xs right-1 bottom-[16px]">
                            (${requestedAmountInUsd})
                        </span>
                    ) : null}
                </NumericInput>
            </div>
            {
                from && to && fromCurrency ?
                    <MinMax onAddressGet={(a) => setWalletAddress(a)} />
                    :
                    <></>
            }
        </div >
    </>)
});

export default AmountField