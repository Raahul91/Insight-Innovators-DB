package com.hackathon.dto;

public record InvestmentInsightRequest(
        CustomerProfile customerProfile,
        Order order
        
) {}
