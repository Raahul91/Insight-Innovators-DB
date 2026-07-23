package com.hackathon.dto;

import java.util.List;

public record PortfolioContext(
        Double netWorth,
        Double totalInvested,
        Double totalGain,
        Double totalGainPct,
        List<PortfolioHolding> holdings
) {}
