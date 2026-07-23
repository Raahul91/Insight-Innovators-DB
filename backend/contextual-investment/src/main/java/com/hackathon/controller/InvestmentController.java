package com.hackathon.controller;

import com.hackathon.dto.InvestmentInsightRequest;
import com.hackathon.dto.InvestmentInsightResponse;
import com.hackathon.service.InvestmentInsightService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/contextual-insights")
public class InvestmentController {

    private final InvestmentInsightService service;

    public InvestmentController(InvestmentInsightService service) {
        this.service = service;
    }

    @PostMapping
    public InvestmentInsightResponse analyze(
            @RequestBody InvestmentInsightRequest request) {

        return service.analyze(request);
    }
}
