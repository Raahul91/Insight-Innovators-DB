package com.hackathon.dto;

public record Order(
        String instrumentId,
        String instrumentName,
        String action,
        Integer quantity
) {}
