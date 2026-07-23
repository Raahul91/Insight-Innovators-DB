package com.hackathon.dto;

public record PortfolioHolding(
        String ticker,
        String name,
        String category,
        Double shares,
        Double avgCost,
        Double currentPrice,
        Double dayChangePct
) {}
