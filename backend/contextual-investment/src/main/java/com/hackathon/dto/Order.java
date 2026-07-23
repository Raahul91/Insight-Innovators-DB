package com.hackathon.dto;

public record Order(
        String instrumentId,
        String instrumentSymbol,
        String instrumentName,
        String action,
        Integer quantity
) {}
