package com.hackathon.dto;

import java.util.List;

public record InvestmentInsightResponse(

        Recommendation recommendation,

        Integer confidence,

        Suitability customerSuitability,

        RiskLevel riskLevel,

        MarketSentiment marketSentiment,

        String summary,

        List<String> positiveFactors,

        List<String> negativeFactors,

        List<AlternativeInvestment> alternatives

) {}
